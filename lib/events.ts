import { db, schema } from './db';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { parseJSON, uid } from './util';
import { userMap, postSystem, type PubUser } from './chat';
import { publish, presenceCount } from './bus';
import { notify } from './notify';
import { summarizeDiscussion, type DiscussionSummary } from './ai';

export type EventRow = typeof schema.events.$inferSelect;

export async function serializeEvents(evs: EventRow[], meId: string) {
  if (!evs.length) return [];
  const ids = evs.map((e) => e.id);
  const rs = await db.select().from(schema.rsvps).where(inArray(schema.rsvps.eventId, ids)).orderBy(asc(schema.rsvps.createdAt));
  const um = await userMap([...new Set(rs.map((r) => r.userId))]);
  return evs.map((e) => {
    const mine = rs.filter((r) => r.eventId === e.id);
    return {
      ...e,
      summary: parseJSON<DiscussionSummary | null>(e.summary, null),
      going: mine.some((r) => r.userId === meId),
      rsvpCount: mine.length,
      attendees: mine.slice(-5).reverse().map((r) => um.get(r.userId)).filter(Boolean) as PubUser[],
      watching: e.status === 'live' ? presenceCount(`event:${e.id}`) : 0,
    };
  });
}
export type SerializedEvent = Awaited<ReturnType<typeof serializeEvents>>[number];

export async function liveRoomFor(eventId: string) {
  let r = await db.query.rooms.findFirst({ where: and(eq(schema.rooms.kind, 'live'), eq(schema.rooms.eventId, eventId)) });
  if (!r) {
    const ev = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
    r = { id: uid(), kind: 'live', title: ev?.title ?? 'Live discussion', topic: '', eventId, parentRoomId: null, status: 'active', detectedBy: null, lastActivityAt: Date.now(), archivedAt: null, createdAt: Date.now() };
    await db.insert(schema.rooms).values(r);
  }
  return r;
}

export async function startLive(eventId: string) {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
  if (!ev) throw new Error('not found');
  const t = Date.now();
  await db.update(schema.events).set({ status: 'live', liveStartedAt: t, endedAt: null }).where(eq(schema.events.id, eventId));
  const room = await liveRoomFor(eventId);
  await postSystem(room.id, `${ev.speaker} is live — welcome to the discussion`);
  const users = await db.select({ id: schema.users.id }).from(schema.users);
  for (const u of users) await notify(u.id, { kind: 'live', title: `Live now: ${ev.title}`, body: `${ev.speaker} has started. Join the live discussion & Q&A.`, link: `/live/${ev.id}`, dedupeKey: `live:${ev.id}:${t}` });
  publish(`event:${eventId}`, 'status', { status: 'live' });
  publish('events', 'update', { eventId });
}

export async function endLive(eventId: string) {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, eventId) });
  if (!ev) throw new Error('not found');
  const t = Date.now();
  const room = await liveRoomFor(eventId);
  const msgs = await db.select().from(schema.messages).where(and(eq(schema.messages.roomId, room.id), eq(schema.messages.kind, 'text'))).orderBy(asc(schema.messages.createdAt));
  const qs = await questionsFor(eventId, '');
  const um = await userMap([...new Set(msgs.map((m) => m.userId!).filter(Boolean))]);
  // attendance: RSVPs + anyone who chatted / joined live
  const rs = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventId, eventId));
  const participants = new Set([...rs.map((r) => r.userId), ...msgs.map((m) => m.userId!).filter(Boolean)]);
  for (const p of participants) await db.insert(schema.attendance).values({ eventId, userId: p, at: t }).onConflictDoNothing();
  const att = await db.select({ n: sql<number>`count(*)` }).from(schema.attendance).where(eq(schema.attendance.eventId, eventId));
  const summary = await summarizeDiscussion({
    title: ev.title, speaker: ev.speaker,
    messages: msgs.map((m) => ({ name: um.get(m.userId!)?.name ?? 'Member', body: m.body })),
    questions: qs.map((q) => ({ body: q.body, votes: q.votes, name: q.user?.name })),
    attended: Number(att[0]?.n ?? 0),
    durationMin: Math.max(1, Math.round((t - (ev.liveStartedAt ?? ev.startsAt)) / 60_000)),
  });
  // ensure a library entry exists for the recording
  let libId = ev.libraryItemId;
  if (!libId) {
    libId = uid();
    await db.insert(schema.libraryItems).values({
      id: libId, title: ev.title, speaker: ev.speaker, category: ev.kind, mediaType: ev.streamUrl ? 'video' : 'none', mediaUrl: ev.streamUrl ?? '',
      duration: `${summary.stats.durationMin} min`, recordedAt: ev.liveStartedAt ?? ev.startsAt,
      summary: ev.description || summary.overview, keyPoints: JSON.stringify(summary.insights.map((i) => ({ text: i.text, ts: '' }))),
      transcript: '', thumb: (Math.abs(hash(ev.id)) % 6) + 1, eventId: ev.id, summaryMethod: summary.method, createdAt: t,
    });
  }
  await db.update(schema.events).set({ status: 'ended', endedAt: t, summary: JSON.stringify(summary), libraryItemId: libId }).where(eq(schema.events.id, eventId));
  await postSystem(room.id, 'The session has ended. A discussion summary is ready.', { summaryLink: `/events/${eventId}/summary` });
  for (const p of participants) await notify(p, { kind: 'summary', title: 'Discussion summary ready', body: ev.title, link: `/events/${eventId}/summary`, dedupeKey: `summary:${eventId}:${t}` });
  publish(`event:${eventId}`, 'status', { status: 'ended' });
  publish('events', 'update', { eventId });
  return summary;
}

function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

export async function questionsFor(eventId: string, meId: string) {
  const qs = await db.select().from(schema.questions).where(eq(schema.questions.eventId, eventId)).orderBy(desc(schema.questions.createdAt));
  if (!qs.length) return [];
  const votes = await db.select().from(schema.questionVotes).where(inArray(schema.questionVotes.questionId, qs.map((q) => q.id)));
  const um = await userMap([...new Set(qs.map((q) => q.userId))]);
  return qs.map((q) => {
    const v = votes.filter((x) => x.questionId === q.id);
    return { ...q, votes: v.length, voted: v.some((x) => x.userId === meId), user: um.get(q.userId) ?? null };
  }).sort((a, b) => (a.status === 'answering' ? -1 : 0) - (b.status === 'answering' ? -1 : 0) || (a.status === 'answered' ? 1 : 0) - (b.status === 'answered' ? 1 : 0) || b.votes - a.votes || b.createdAt - a.createdAt);
}

export async function profileStats(userId: string) {
  const att = await db.select().from(schema.attendance).where(eq(schema.attendance.userId, userId));
  const notesN = await db.select({ n: sql<number>`count(*)` }).from(schema.notes).where(eq(schema.notes.userId, userId));
  const WEEK = 7 * 86400_000;
  const t = Date.now();
  const weeks = Array.from({ length: 12 }, (_, i) => att.filter((a) => a.at > t - (12 - i) * WEEK && a.at <= t - (11 - i) * WEEK).length);
  let streak = 0;
  for (let i = 11; i >= 0; i--) { if (weeks[i] > 0) streak++; else if (i === 11) continue; else break; }
  return { attended: att.length, streak, notes: Number(notesN[0]?.n ?? 0), weeks };
}
