import { adminApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { desc, eq, sql } from 'drizzle-orm';
export const GET = adminApi(async () => {
  const [apps, invites, members, events, lib, att, ended] = await Promise.all([
    db.select().from(schema.applications).orderBy(desc(schema.applications.createdAt)),
    db.select().from(schema.invites).orderBy(desc(schema.invites.createdAt)),
    db.select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, initials: schema.users.initials, color: schema.users.color, role: schema.users.role, isDemo: schema.users.isDemo, createdAt: schema.users.createdAt }).from(schema.users).orderBy(desc(schema.users.createdAt)),
    db.select().from(schema.events).orderBy(desc(schema.events.startsAt)),
    db.select({ id: schema.libraryItems.id, title: schema.libraryItems.title, speaker: schema.libraryItems.speaker, category: schema.libraryItems.category, mediaType: schema.libraryItems.mediaType, mediaUrl: schema.libraryItems.mediaUrl, recordedAt: schema.libraryItems.recordedAt }).from(schema.libraryItems).orderBy(desc(schema.libraryItems.recordedAt)),
    db.select({ n: sql<number>`count(*)` }).from(schema.attendance),
    db.select({ n: sql<number>`count(*)` }).from(schema.events).where(eq(schema.events.status, 'ended')),
  ]);
  const avg = members.length && Number(ended[0].n) ? Math.min(100, Math.round((Number(att[0].n) / (members.length * Number(ended[0].n))) * 100)) : 0;
  return { applications: apps, invites, members, events, library: lib, stats: { members: members.length, pending: apps.filter((a) => a.status === 'pending').length, avgAttendance: avg } };
});
