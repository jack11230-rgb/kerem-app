import { db, schema } from './db';
import { publish } from './bus';
import { uid } from './util';
import { eq } from 'drizzle-orm';

export async function notify(userId: string, n: { kind: string; title: string; body?: string; link?: string; dedupeKey?: string }) {
  const row = { id: uid(), userId, kind: n.kind, title: n.title, body: n.body ?? '', link: n.link ?? '', dedupeKey: n.dedupeKey ?? null, readAt: null, createdAt: Date.now() };
  // (user_id, dedupe_key) is unique: a repeat of an already-sent notification is silently skipped.
  // (Drizzle wraps driver errors as "Failed query: …", so the old catch-on-'UNIQUE' never matched.)
  const inserted = await db.insert(schema.notifications).values(row).onConflictDoNothing().returning({ id: schema.notifications.id });
  if (inserted.length === 0) return null; // already notified
  publish(`user:${userId}`, 'notification', row);
  return row;
}

export async function notifyAdmins(n: Parameters<typeof notify>[1]) {
  const admins = await db.select().from(schema.users).where(eq(schema.users.role, 'admin'));
  for (const a of admins) await notify(a.id, n);
}
