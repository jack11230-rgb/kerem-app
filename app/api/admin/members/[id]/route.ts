import { adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { isOwnerEmail } from '@/lib/owners';
export const PATCH = adminApi(async (req, { params }, u) => {
  const b = await body(req);
  const role = str(b.role, 10);
  if (!['member', 'admin'].includes(role)) throw new HttpError(400, 'bad role');
  if (params.id === u.id && role !== 'admin') throw new HttpError(400, "You can't remove your own admin role");
  if (role !== 'admin') {
    const target = await db.query.users.findFirst({ where: eq(schema.users.id, params.id) });
    if (target && isOwnerEmail(target.email)) throw new HttpError(400, 'This member is an owner (OWNER_EMAILS) and stays admin');
  }
  await db.update(schema.users).set({ role }).where(eq(schema.users.id, params.id));
  return { ok: true };
});
