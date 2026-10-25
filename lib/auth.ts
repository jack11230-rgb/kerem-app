import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db, ensureDb, schema } from './db';
import { eq } from 'drizzle-orm';
import { uid } from './util';

export const COOKIE = 'kerem_session';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export type SessionUser = typeof schema.users.$inferSelect;

export async function hashPassword(p: string) { return bcrypt.hash(p, 10); }
export async function verifyPassword(p: string, h: string) { return bcrypt.compare(p, h); }

export async function createSession(userId: string) {
  await ensureDb();
  const id = uid(32);
  await db.insert(schema.sessions).values({ id, userId, expiresAt: Date.now() + MAX_AGE * 1000 });
  const jar = await cookies();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: MAX_AGE, secure: process.env.COOKIE_SECURE === '1' });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id) await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
  jar.delete(COOKIE);
}

export async function getUser(): Promise<SessionUser | null> {
  await ensureDb();
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const s = await db.query.sessions.findFirst({ where: eq(schema.sessions.id, id) });
  if (!s || s.expiresAt < Date.now()) return null;
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, s.userId) });
  return u ?? null;
}

export function publicUser(u: SessionUser) {
  return { id: u.id, name: u.name, initials: u.initials, color: u.color, role: u.role, title: u.title };
}
