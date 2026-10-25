import { userApi, body } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
export const POST = userApi(async (req, _c, u) => {
  const b = await body<{ ids?: string[] }>(req);
  const w = Array.isArray(b.ids) && b.ids.length
    ? and(eq(schema.notifications.userId, u.id), inArray(schema.notifications.id, b.ids.map(String)))
    : and(eq(schema.notifications.userId, u.id), isNull(schema.notifications.readAt));
  await db.update(schema.notifications).set({ readAt: Date.now() }).where(w);
  return { ok: true };
});
