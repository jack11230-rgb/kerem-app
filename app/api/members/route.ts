import { userApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { asc } from 'drizzle-orm';
import { presenceUsers } from '@/lib/bus';
export const GET = userApi(async () => {
  const rows = await db.select().from(schema.users).orderBy(asc(schema.users.name));
  const online = new Set(presenceUsers('app'));
  return { members: rows.map((u) => ({ id: u.id, name: u.name, initials: u.initials, color: u.color, title: u.title, role: u.role, online: online.has(u.id), isDemo: !!u.isDemo })) };
});
