import { userApi, adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { serializeEvents, liveRoomFor, questionsFor, startLive, endLive } from '@/lib/events';
import { listMessages } from '@/lib/chat';

export const GET = userApi(async (_r, { params }, u) => {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, params.id) });
  if (!ev) throw new HttpError(404, 'Event not found');
  const [s] = await serializeEvents([ev], u.id);
  const room = await liveRoomFor(ev.id);
  if (ev.status === 'live') await db.insert(schema.attendance).values({ eventId: ev.id, userId: u.id, at: Date.now() }).onConflictDoNothing();
  return { event: s, room, messages: await listMessages(room.id), questions: await questionsFor(ev.id, u.id) };
});

export const POST = adminApi(async (req, { params }) => {
  const b = await body(req);
  const action = str(b.action, 10);
  if (action === 'start') { await startLive(params.id); return { ok: true }; }
  if (action === 'end') { const summary = await endLive(params.id); return { ok: true, summary }; }
  throw new HttpError(400, 'action must be start or end');
});
