import { userApi, adminApi, body, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, desc, eq } from 'drizzle-orm';
import { libRow, libInput } from '@/lib/library';
import { parseJSON } from '@/lib/util';
import type { DiscussionSummary } from '@/lib/ai';

export const GET = userApi(async (_r, { params }, u) => {
  const r = await db.query.libraryItems.findFirst({ where: eq(schema.libraryItems.id, params.id) });
  if (!r) throw new HttpError(404, 'Not found');
  const ev = r.eventId ? await db.query.events.findFirst({ where: eq(schema.events.id, r.eventId) }) : null;
  const myNotes = await db.select().from(schema.notes).where(and(eq(schema.notes.userId, u.id), eq(schema.notes.libraryItemId, r.id))).orderBy(desc(schema.notes.createdAt));
  return { item: libRow(r), discussion: ev ? parseJSON<DiscussionSummary | null>(ev.summary, null) : null, eventId: ev?.id ?? null, notes: myNotes };
});
export const PATCH = adminApi(async (req, { params }) => {
  const o = await libInput(await body(req));
  await db.update(schema.libraryItems).set(o).where(eq(schema.libraryItems.id, params.id));
  return { ok: true };
});
export const DELETE = adminApi(async (_r, { params }) => {
  await db.delete(schema.libraryItems).where(eq(schema.libraryItems.id, params.id));
  return { ok: true };
});
