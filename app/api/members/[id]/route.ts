import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { profileStats } from '@/lib/events';
import { parseJSON } from '@/lib/util';
export const GET = userApi(async (_r, { params }, me) => {
  const id = params.id === 'me' ? me.id : params.id;
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!u) throw new HttpError(404, 'Member not found');
  const notes = await db.select().from(schema.notes).where(eq(schema.notes.userId, id)).orderBy(desc(schema.notes.createdAt)).limit(10);
  const libIds = [...new Set(notes.map((n) => n.libraryItemId).filter(Boolean) as string[])];
  const libs = libIds.length ? await db.select({ id: schema.libraryItems.id, title: schema.libraryItems.title }).from(schema.libraryItems).where(inArray(schema.libraryItems.id, libIds)) : [];
  return {
    member: { id: u.id, name: u.name, initials: u.initials, color: u.color, role: u.role, title: u.title, bio: u.bio, interests: parseJSON<string[]>(u.interests, []), createdAt: u.createdAt, isDemo: !!u.isDemo },
    stats: await profileStats(id),
    highlights: notes.map((n) => ({ ...n, sourceTitle: libs.find((l) => l.id === n.libraryItemId)?.title ?? '' })),
    isMe: id === me.id,
  };
});
