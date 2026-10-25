import { publicApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, createSession, publicUser } from '@/lib/auth';
import { checkInvite } from '@/lib/invites';
import { uid, initialsOf } from '@/lib/util';
import { notifyAdmins } from '@/lib/notify';

export const POST = publicApi(async (req) => {
  const b = await body(req);
  const name = str(b.name, 80);
  const email = str(b.email, 200).toLowerCase();
  const password = str(b.password, 200);
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Please enter your name and a valid email');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  const r = await checkInvite(str(b.code, 20));
  if (!r.valid) throw new HttpError(400, r.reason);
  if (r.invite.email && r.invite.email.toLowerCase() !== email) throw new HttpError(400, 'This invitation was issued to a different email address');
  if (await db.query.users.findFirst({ where: eq(schema.users.email, email) })) throw new HttpError(409, 'An account with this email already exists — sign in instead');
  const n = await db.select({ n: sql<number>`count(*)` }).from(schema.users);
  const id = uid();
  await db.insert(schema.users).values({
    id, email, name, passwordHash: await hashPassword(password), initials: initialsOf(name), color: (Number(n[0]?.n ?? 0) % 6) + 1,
    role: r.invite.role === 'admin' ? 'admin' : 'member', title: 'New Member', bio: '', interests: '[]', isDemo: 0, createdAt: Date.now(),
  });
  await db.update(schema.invites).set({ uses: r.invite.uses + 1 }).where(eq(schema.invites.code, r.invite.code));
  await db.update(schema.applications).set({ status: 'approved' }).where(eq(schema.applications.inviteCode, r.invite.code));
  await notifyAdmins({ kind: 'member', title: 'New member joined', body: `${name} joined with invite ${r.invite.code}`, link: '/admin?tab=members' });
  await createSession(id);
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  return { user: publicUser(u!) };
});
