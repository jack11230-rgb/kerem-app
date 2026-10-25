import { publicApi, userApi, body, str } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { aiStatus } from '@/lib/ai';
import { parseJSON } from '@/lib/util';

export const GET = publicApi(async (_req, _c, u) => {
  if (!u) return { user: null, ai: aiStatus() };
  await db.update(schema.users).set({ lastSeenAt: Date.now() }).where(eq(schema.users.id, u.id));
  const unread = await db.select({ n: sql<number>`count(*)` }).from(schema.notifications).where(and(eq(schema.notifications.userId, u.id), isNull(schema.notifications.readAt)));
  return { user: { id: u.id, name: u.name, email: u.email, initials: u.initials, color: u.color, role: u.role, title: u.title, bio: u.bio, interests: parseJSON<string[]>(u.interests, []), createdAt: u.createdAt, isDemo: !!u.isDemo }, unread: Number(unread[0]?.n ?? 0), ai: aiStatus() };
});

export const PATCH = userApi(async (req, _c, u) => {
  const b = await body(req);
  const patch: Partial<typeof schema.users.$inferInsert> = {};
  if (typeof b.bio === 'string') patch.bio = str(b.bio, 600);
  if (typeof b.name === 'string' && str(b.name, 80)) patch.name = str(b.name, 80);
  if (Array.isArray(b.interests)) patch.interests = JSON.stringify((b.interests as unknown[]).map((x) => str(x, 30)).filter(Boolean).slice(0, 12));
  if (Object.keys(patch).length) await db.update(schema.users).set(patch).where(eq(schema.users.id, u.id));
  return { ok: true };
});
