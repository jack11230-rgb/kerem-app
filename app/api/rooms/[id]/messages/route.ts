import { userApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { postMessage, getHall } from '@/lib/chat';

const last = new Map<string, number>();
export const POST = userApi(async (req, { params }, u) => {
  const text = str((await body(req)).body, 2000);
  if (!text) throw new HttpError(400, 'Message is empty');
  const t = Date.now();
  if (t - (last.get(u.id) ?? 0) < 300) throw new HttpError(429, 'Slow down a little');
  last.set(u.id, t);
  const room = params.id === 'hall' ? await getHall() : await db.query.rooms.findFirst({ where: eq(schema.rooms.id, params.id) });
  if (!room) throw new HttpError(404, 'Room not found');
  if (room.kind === 'live') {
    const ev = room.eventId ? await db.query.events.findFirst({ where: eq(schema.events.id, room.eventId) }) : null;
    if (ev?.status !== 'live') throw new HttpError(400, 'This live session is not running');
  }
  return { message: await postMessage(room.id, u.id, text) };
});
