import { userApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { uid } from '@/lib/util';

export const GET = userApi(async (req, _c, u) => {
  const uidParam = new URL(req.url).searchParams.get('user') || u.id;
  const rows = await db.select().from(schema.notes).where(eq(schema.notes.userId, uidParam)).orderBy(desc(schema.notes.createdAt)).limit(200);
  const libIds = [...new Set(rows.map((r) => r.libraryItemId).filter(Boolean) as string[])];
  const evIds = [...new Set(rows.map((r) => r.eventId).filter(Boolean) as string[])];
  const libs = libIds.length ? await db.select({ id: schema.libraryItems.id, title: schema.libraryItems.title }).from(schema.libraryItems).where(inArray(schema.libraryItems.id, libIds)) : [];
  const evs = evIds.length ? await db.select({ id: schema.events.id, title: schema.events.title }).from(schema.events).where(inArray(schema.events.id, evIds)) : [];
  return { notes: rows.map((r) => ({ ...r, sourceTitle: libs.find((l) => l.id === r.libraryItemId)?.title ?? evs.find((e) => e.id === r.eventId)?.title ?? '' })) };
});

export const POST = userApi(async (req, _c, u) => {
  const b = await body(req);
  const text = str(b.text, 2000);
  if (!text) throw new HttpError(400, 'Note is empty');
  const id = uid();
  await db.insert(schema.notes).values({ id, userId: u.id, libraryItemId: str(b.libraryItemId, 40) || null, eventId: str(b.eventId, 40) || null, text, ts: str(b.ts, 10), createdAt: Date.now() });
  return { id };
});
