// Background jobs (single-process). Reminders "starts in 15 min", auto-archive quiet side rooms.
// On serverless hosts, replace with a cron hitting /api/cron.
import { db, ensureDb, schema } from './db';
import { and, asc, eq, gt, lt } from 'drizzle-orm';
import { notify } from './notify';
import { publish } from './bus';
import { postSystem, getHall, userMap } from './chat';
import { recapRoom } from './ai';

const g = globalThis as unknown as { __keremSched?: NodeJS.Timeout };

export async function runJobs() {
  await ensureDb();
  const t = Date.now();
  const mins = Number(process.env.REMINDER_MINUTES || 15);
  // 1. reminders
  const soon = await db.select().from(schema.events).where(and(eq(schema.events.status, 'scheduled'), gt(schema.events.startsAt, t), lt(schema.events.startsAt, t + mins * 60_000)));
  for (const ev of soon) {
    const rs = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventId, ev.id));
    const inMin = Math.max(1, Math.round((ev.startsAt - t) / 60_000));
    for (const r of rs) {
      await notify(r.userId, { kind: 'reminder', title: `${ev.kind === 'shiur' ? 'Shiur' : 'Lecture'} starts in ${inMin} min`, body: `${ev.title} with ${ev.speaker} — ${ev.onlineUrl || ev.streamUrl ? 'tap to join the live room.' : ev.location}`, link: `/events/${ev.id}`, dedupeKey: `reminder:${ev.id}` });
    }
  }
  // 2. auto-archive quiet side rooms
  const hours = Number(process.env.ROOM_ARCHIVE_HOURS || 24);
  const quiet = await db.select().from(schema.rooms).where(and(eq(schema.rooms.kind, 'side'), eq(schema.rooms.status, 'active'), lt(schema.rooms.lastActivityAt, t - hours * 3600_000)));
  for (const r of quiet) await archiveRoom(r.id);
}

export async function archiveRoom(roomId: string) {
  const r = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) });
  if (!r || r.status === 'archived') return;
  await db.update(schema.rooms).set({ status: 'archived', archivedAt: Date.now() }).where(eq(schema.rooms.id, roomId));
  const msgs = await db.select().from(schema.messages).where(and(eq(schema.messages.roomId, roomId), eq(schema.messages.kind, 'text'))).orderBy(asc(schema.messages.createdAt));
  const um = await userMap([...new Set(msgs.map((m) => m.userId!).filter(Boolean))]);
  const recap = await recapRoom(r.title, msgs.map((m) => ({ name: um.get(m.userId!)?.name ?? 'Member', body: m.body })));
  const hall = await getHall();
  await postSystem(hall.id, recap, { roomId, title: r.title }, 'recap');
  publish('rooms', 'update', { roomId });
}

export function ensureScheduler() {
  if (g.__keremSched || process.env.NEXT_PHASE === 'phase-production-build') return;
  g.__keremSched = setInterval(() => { runJobs().catch((e) => console.error('[jobs]', e)); }, 30_000);
  setTimeout(() => runJobs().catch(() => {}), 2000);
}
