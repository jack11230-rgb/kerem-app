import { publicApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { verifyPassword, createSession, publicUser } from '@/lib/auth';

export const POST = publicApi(async (req) => {
  const b = await body(req);
  const email = str(b.email, 200).toLowerCase();
  const u = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
  if (!u || !(await verifyPassword(str(b.password, 200), u.passwordHash))) throw new HttpError(401, 'Email or password is incorrect');
  await createSession(u.id);
  return { user: publicUser(u) };
});
