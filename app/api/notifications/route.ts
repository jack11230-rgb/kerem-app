import { userApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
export const GET = userApi(async (_r, _c, u) => {
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, u.id)).orderBy(desc(schema.notifications.createdAt)).limit(100);
  return { notifications: rows };
});
