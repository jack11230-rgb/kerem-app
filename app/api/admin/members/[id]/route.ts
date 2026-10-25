import { adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
export const PATCH = adminApi(async (req, { params }, u) => {
  const b = await body(req);
  const role = str(b.role, 10);
  if (!['member', 'admin'].includes(role)) throw new HttpError(400, 'bad role');
  if (params.id === u.id && role !== 'admin') throw new HttpError(400, "You can't remove your own admin role");
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, params.id));
  return { ok: true };
});
