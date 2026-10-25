import { userApi, adminApi, body, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { serializeEvents } from '@/lib/events';
import { eventInput } from '@/lib/validate';
import { publish } from '@/lib/bus';

export const GET = userApi(async (_r, { params }, u) => {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, params.id) });
  if (!ev) throw new HttpError(404, 'Event not found');
  const [s] = await serializeEvents([ev], u.id);
  const all = await db.select().from(schema.rsvps).where(eq(schema.rsvps.eventId, ev.id));
  const users = all.length ? await db.select({ id: schema.users.id, name: schema.users.name, initials: schema.users.initials, color: schema.users.color }).from(schema.users) : [];
  return { event: s, going: users.filter((x) => all.some((r) => r.userId === x.id)) };
});
export const PATCH = adminApi(async (req, { params }) => {
  const o = eventInput(await body(req), true);
  await db.update(schema.events).set(o).where(eq(schema.events.id, params.id));
  publish('events', 'update', { eventId: params.id });
  return { ok: true };
});
export const DELETE = adminApi(async (_r, { params }) => {
  await db.delete(schema.events).where(eq(schema.events.id, params.id));
  await db.delete(schema.rsvps).where(eq(schema.rsvps.eventId, params.id));
  publish('events', 'update', { eventId: params.id });
  return { ok: true };
});
