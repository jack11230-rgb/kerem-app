import { userApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
export const DELETE = userApi(async (_r, { params }, u) => {
  await db.delete(schema.notes).where(and(eq(schema.notes.id, params.id), eq(schema.notes.userId, u.id)));
  return { ok: true };
});
