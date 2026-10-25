import { db, schema } from './db';
import { publish } from './bus';
import { uid } from './util';
import { eq } from 'drizzle-orm';

export async function notify(userId: string, n: { kind: string; title: string; body?: string; link?: string; dedupeKey?: string }) {
  const row = { id: uid(), userId, kind: n.kind, title: n.title, body: n.body ?? '', link: n.link ?? '', dedupeKey: n.dedupeKey ?? null, readAt: null, createdAt: Date.now() };
  try {
    await db.insert(schema.notifications).values(row);
  } catch (e) {
    if (String(e).includes('UNIQUE')) return null; // already notified
    throw e;
  }
  publish(`user:${userId}`, 'notification', row);
  return row;
}

export async function notifyAdmins(n: Parameters<typeof notify>[1]) {
  const admins = await db.select().from(schema.users).where(eq(schema.users.role, 'admin'));
  for (const a of admins) await notify(a.id, n);
}
