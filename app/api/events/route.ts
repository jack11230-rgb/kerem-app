import { userApi, adminApi, body } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, asc, desc, gte, lt, ne, or, eq } from 'drizzle-orm';
import { serializeEvents } from '@/lib/events';
import { eventInput } from '@/lib/validate';
import { uid } from '@/lib/util';
import { publish } from '@/lib/bus';

export const GET = userApi(async (req, _c, u) => {
  const url = new URL(req.url);
  const scope = url.searchParams.get('scope') || 'upcoming';
  const t = Date.now();
  let rows;
  if (scope === 'month') {
    const from = Number(url.searchParams.get('from')), to = Number(url.searchParams.get('to'));
    rows = await db.select().from(schema.events).where(and(gte(schema.events.startsAt, from), lt(schema.events.startsAt, to))).orderBy(asc(schema.events.startsAt));
  } else if (scope === 'past') {
    rows = await db.select().from(schema.events).where(eq(schema.events.status, 'ended')).orderBy(desc(schema.events.startsAt)).limit(50);
  } else if (scope === 'all') {
    rows = await db.select().from(schema.events).orderBy(desc(schema.events.startsAt)).limit(200);
  } else {
    rows = await db.select().from(schema.events).where(and(ne(schema.events.status, 'ended'), or(gte(schema.events.startsAt, t - 3 * 3600_000), eq(schema.events.status, 'live')))).orderBy(asc(schema.events.startsAt)).limit(50);
  }
  return { events: await serializeEvents(rows, u.id) };
});

export const POST = adminApi(async (req) => {
  const o = eventInput(await body(req));
  const id = uid();
  await db.insert(schema.events).values({ id, ...(o as { title: string; speaker: string; startsAt: number }), status: 'scheduled', createdAt: Date.now() });
  publish('events', 'update', { eventId: id });
  return { id };
});
