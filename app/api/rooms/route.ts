import { userApi } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { roomStats, userMap } from '@/lib/chat';

export const GET = userApi(async (req, _c, u) => {
  const f = new URL(req.url).searchParams.get('filter') || 'active';
  let rows = await db.select().from(schema.rooms).where(and(eq(schema.rooms.kind, 'side'), eq(schema.rooms.status, f === 'archived' ? 'archived' : 'active'))).orderBy(desc(schema.rooms.lastActivityAt));
  const mem = rows.length ? await db.select().from(schema.roomMembers).where(inArray(schema.roomMembers.roomId, rows.map((r) => r.id))) : [];
  if (f === 'mine') {
    const all = await db.select().from(schema.rooms).where(eq(schema.rooms.kind, 'side')).orderBy(desc(schema.rooms.lastActivityAt));
    const mine = await db.select().from(schema.roomMembers).where(eq(schema.roomMembers.userId, u.id));
    rows = all.filter((r) => mine.some((m) => m.roomId === r.id));
    mem.push(...(rows.length ? await db.select().from(schema.roomMembers).where(inArray(schema.roomMembers.roomId, rows.map((r) => r.id))) : []));
  }
  const stats = await roomStats(rows.map((r) => r.id));
  const um = await userMap([...new Set(mem.map((m) => m.userId))]);
  const counts = await Promise.all([
    db.select({ id: schema.rooms.id }).from(schema.rooms).where(and(eq(schema.rooms.kind, 'side'), eq(schema.rooms.status, 'active'))),
    db.select({ id: schema.rooms.id }).from(schema.rooms).where(and(eq(schema.rooms.kind, 'side'), eq(schema.rooms.status, 'archived'))),
  ]);
  const t = Date.now();
  return {
    counts: { active: counts[0].length, archived: counts[1].length },
    rooms: rows.map((r) => {
      const ms = [...new Map(mem.filter((m) => m.roomId === r.id).map((m) => [m.userId, m])).values()];
      const st = stats.get(r.id) ?? { recent: 0, total: 0 };
      const quietMin = Math.round((t - r.lastActivityAt) / 60_000);
      return {
        ...r, memberCount: ms.length, members: ms.slice(0, 5).map((m) => um.get(m.userId)).filter(Boolean),
        joined: ms.some((m) => m.userId === u.id), recent: st.recent,
        activity: r.status === 'archived' ? 'archived' : quietMin < 15 ? (st.recent >= 8 ? 'hot' : 'lively') : 'quiet', quietMin,
        isNew: t - r.createdAt < 3600_000,
      };
    }),
  };
});
