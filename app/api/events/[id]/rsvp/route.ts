import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { serializeEvents } from '@/lib/events';
import { publish } from '@/lib/bus';

export const POST = userApi(async (_r, { params }, u) => {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, params.id) });
  if (!ev) throw new HttpError(404, 'Event not found');
  const w = and(eq(schema.rsvps.eventId, ev.id), eq(schema.rsvps.userId, u.id));
  const existing = await db.query.rsvps.findFirst({ where: w });
  if (existing) await db.delete(schema.rsvps).where(w);
  else await db.insert(schema.rsvps).values({ eventId: ev.id, userId: u.id, createdAt: Date.now() });
  const [s] = await serializeEvents([ev], u.id);
  publish('events', 'rsvp', { eventId: ev.id, rsvpCount: s.rsvpCount, attendees: s.attendees, by: u.id, going: !existing });
  return { event: s };
});
