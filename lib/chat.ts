import { db, schema } from './db';
import { and, asc, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import { publish } from './bus';
import { uid, parseJSON } from './util';
import { factCheck, detectHeat, type ChatMsg, type FactCheck } from './ai';
import { notify } from './notify';

export type Msg = typeof schema.messages.$inferSelect;
export type PubUser = { id: string; name: string; initials: string; color: number };

export async function userMap(ids?: string[]) {
  const rows = ids && ids.length
    ? await db.select().from(schema.users).where(inArray(schema.users.id, ids))
    : ids ? [] : await db.select().from(schema.users);
  const m = new Map<string, PubUser>();
  for (const u of rows) m.set(u.id, { id: u.id, name: u.name, initials: u.initials, color: u.color });
  return m;
}

export function serialize(m: Msg, users: Map<string, PubUser>) {
  return {
    id: m.id, roomId: m.roomId, kind: m.kind, body: m.body,
    meta: parseJSON<Record<string, unknown> | null>(m.meta, null),
    factCheck: parseJSON<FactCheck | null>(m.factCheck, null),
    movedToRoomId: m.movedToRoomId, createdAt: m.createdAt,
    user: m.userId ? users.get(m.userId) ?? { id: m.userId, name: 'Member', initials: '?', color: 1 } : null,
  };
}
export type SerializedMsg = ReturnType<typeof serialize>;

export async function serializeMany(ms: Msg[]) {
  const ids = [...new Set(ms.map((m) => m.userId).filter(Boolean) as string[])];
  const users = await userMap(ids);
  // enrich room cards with live member counts
  const out = ms.map((m) => serialize(m, users));
  const cardRoomIds = out.filter((m) => m.kind === 'roomcard' && m.meta?.roomId).map((m) => String(m.meta!.roomId));
  if (cardRoomIds.length) {
    const mem = await db.select().from(schema.roomMembers).where(inArray(schema.roomMembers.roomId, cardRoomIds));
    const rs = await db.select().from(schema.rooms).where(inArray(schema.rooms.id, cardRoomIds));
    const allU = await userMap([...new Set(mem.map((x) => x.userId))]);
    for (const m of out) {
      if (m.kind !== 'roomcard' || !m.meta?.roomId) continue;
      const rid = String(m.meta.roomId);
      const members = mem.filter((x) => x.roomId === rid).map((x) => allU.get(x.userId)).filter(Boolean);
      m.meta = { ...m.meta, members, status: rs.find((r) => r.id === rid)?.status ?? 'active' };
    }
  }
  return out;
}

export async function getHall() {
  let hall = await db.query.rooms.findFirst({ where: eq(schema.rooms.kind, 'hall') });
  if (!hall) {
    hall = { id: 'hall', kind: 'hall', title: "Members' Hall", topic: '', eventId: null, parentRoomId: null, status: 'active', detectedBy: null, lastActivityAt: Date.now(), archivedAt: null, createdAt: Date.now() };
    await db.insert(schema.rooms).values(hall).onConflictDoNothing();
  }
  return hall;
}

export async function listMessages(roomId: string, opts: { includeMoved?: boolean; limit?: number } = {}) {
  const where = opts.includeMoved ? eq(schema.messages.roomId, roomId) : and(eq(schema.messages.roomId, roomId), isNull(schema.messages.movedToRoomId));
  const rows = await db.select().from(schema.messages).where(where).orderBy(desc(schema.messages.createdAt)).limit(opts.limit ?? 150);
  return serializeMany(rows.reverse());
}

export async function joinRoom(roomId: string, userId: string, announce = true) {
  const r = await db.insert(schema.roomMembers).values({ roomId, userId, joinedAt: Date.now() }).onConflictDoNothing().returning();
  if (r.length && announce) {
    const u = (await userMap([userId])).get(userId);
    await postSystem(roomId, `${u?.name ?? 'A member'} joined the room`, { joinedUserId: userId });
  }
  publish(`room:${roomId}`, 'members', await roomMemberList(roomId));
  publish('rooms', 'update', { roomId });
  return r.length > 0;
}

export async function roomMemberList(roomId: string) {
  const mem = await db.select().from(schema.roomMembers).where(eq(schema.roomMembers.roomId, roomId)).orderBy(asc(schema.roomMembers.joinedAt));
  const um = await userMap(mem.map((m) => m.userId));
  return mem.map((m) => um.get(m.userId)).filter(Boolean) as PubUser[];
}

export async function postSystem(roomId: string, body: string, meta?: unknown, kind = 'system') {
  const m: Msg = { id: uid(), roomId, userId: null, kind, body, meta: meta ? JSON.stringify(meta) : null, factCheck: null, movedToRoomId: null, createdAt: Date.now() };
  await db.insert(schema.messages).values(m);
  const [s] = await serializeMany([m]);
  publish(`room:${roomId}`, 'message', s);
  return s;
}

export async function postMessage(roomId: string, userId: string, body: string) {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, roomId) });
  if (!room) throw new Error('Room not found');
  const t = Date.now();
  const m: Msg = { id: uid(), roomId, userId, kind: 'text', body, meta: null, factCheck: null, movedToRoomId: null, createdAt: t };
  await db.insert(schema.messages).values(m);
  await db.update(schema.rooms).set({ lastActivityAt: t, ...(room.status === 'archived' ? { status: 'active', archivedAt: null } : {}) }).where(eq(schema.rooms.id, roomId));
  if (room.kind !== 'hall') await db.insert(schema.roomMembers).values({ roomId, userId, joinedAt: t }).onConflictDoNothing();
  const [s] = await serializeMany([m]);
  publish(`room:${roomId}`, 'message', s);
  if (room.kind === 'side') publish('rooms', 'update', { roomId });
  // fire-and-forget AI work
  void afterPost(room, m).catch((e) => console.error('[chat] afterPost', e));
  return s;
}

async function afterPost(room: typeof schema.rooms.$inferSelect, m: Msg) {
  const fcP = (async () => {
    publish(`room:${room.id}`, 'checking', { id: m.id });
    const fc = await factCheck(m.body);
    if (fc) {
      await db.update(schema.messages).set({ factCheck: JSON.stringify(fc) }).where(eq(schema.messages.id, m.id));
      publish(`room:${room.id}`, 'factcheck', { id: m.id, factCheck: fc });
    } else publish(`room:${room.id}`, 'factcheck', { id: m.id, factCheck: null });
  })();
  if (room.kind === 'hall') await checkHeat(room.id);
  await fcP;
}

const heatLock = new Set<string>();
export async function checkHeat(hallId: string) {
  if (heatLock.has(hallId)) return null;
  heatLock.add(hallId);
  try {
    const since = Date.now() - 5 * 60_000;
    // only look at messages after the most recent room card, not yet moved
    const lastCard = await db.select().from(schema.messages).where(and(eq(schema.messages.roomId, hallId), eq(schema.messages.kind, 'roomcard'))).orderBy(desc(schema.messages.createdAt)).limit(1);
    const floor = Math.max(since, lastCard[0]?.createdAt ?? 0);
    const rows = await db.select().from(schema.messages).where(and(eq(schema.messages.roomId, hallId), eq(schema.messages.kind, 'text'), isNull(schema.messages.movedToRoomId), gt(schema.messages.createdAt, floor))).orderBy(asc(schema.messages.createdAt)).limit(40);
    const recent = rows.slice(-12);
    const um = await userMap([...new Set(recent.map((r) => r.userId!).filter(Boolean))]);
    const input: ChatMsg[] = recent.map((r) => ({ id: r.id, userId: r.userId, name: um.get(r.userId!)?.name ?? 'Member', body: r.body, createdAt: r.createdAt }));
    const heat = await detectHeat(input);
    publish(`room:${hallId}`, 'heat', { score: heat.score, heated: heat.heated, reasons: heat.reasons });
    if (!heat.heated || heat.messageIds.length < 3) return null;
    return await createSideRoom(hallId, heat.title, heat.topic, heat.messageIds, heat.method, heat.reasons);
  } finally {
    heatLock.delete(hallId);
  }
}

export async function createSideRoom(hallId: string, title: string, topic: string, messageIds: string[], method: string, reasons: string[] = []) {
  const t = Date.now();
  const roomId = uid();
  await db.insert(schema.rooms).values({ id: roomId, kind: 'side', title, topic, eventId: null, parentRoomId: hallId, status: 'active', detectedBy: method, lastActivityAt: t, archivedAt: null, createdAt: t });
  const orig = await db.select().from(schema.messages).where(inArray(schema.messages.id, messageIds)).orderBy(asc(schema.messages.createdAt));
  const firstAt = orig[0]?.createdAt ?? t;
  await db.insert(schema.messages).values({ id: uid(), roomId, userId: null, kind: 'system', body: `↳ ${orig.length} messages moved from Members' Hall`, meta: JSON.stringify({ movedCount: orig.length, from: hallId }), factCheck: null, movedToRoomId: null, createdAt: firstAt - 1 });
  for (const o of orig) {
    await db.insert(schema.messages).values({ ...o, id: uid(), roomId, movedToRoomId: null, meta: JSON.stringify({ movedFrom: hallId, originalId: o.id }) });
  }
  await db.update(schema.messages).set({ movedToRoomId: roomId }).where(inArray(schema.messages.id, messageIds));
  const people = [...new Set(orig.map((o) => o.userId).filter(Boolean) as string[])];
  for (const p of people) await db.insert(schema.roomMembers).values({ roomId, userId: p, joinedAt: t }).onConflictDoNothing();
  publish(`room:${hallId}`, 'moved', { ids: messageIds, roomId });
  const card = await postSystem(hallId, `This debate moved to a side room: “${title}”`, { roomId, title, reasons, method }, 'roomcard');
  publish('rooms', 'update', { roomId });
  for (const p of people) await notify(p, { kind: 'room', title: 'Your debate moved to a side room', body: `“${title}” — keep the conversation going there.`, link: `/rooms/${roomId}`, dedupeKey: `room:${roomId}` });
  return { roomId, card };
}

export async function roomStats(roomIds: string[]) {
  if (!roomIds.length) return new Map<string, { recent: number; total: number }>();
  const since = Date.now() - 15 * 60_000;
  const rows = await db.select({ roomId: schema.messages.roomId, total: sql<number>`count(*)`, recent: sql<number>`sum(case when ${schema.messages.createdAt} > ${since} and ${schema.messages.kind} = 'text' then 1 else 0 end)` })
    .from(schema.messages).where(inArray(schema.messages.roomId, roomIds)).groupBy(schema.messages.roomId);
  return new Map(rows.map((r) => [r.roomId, { recent: Number(r.recent ?? 0), total: Number(r.total ?? 0) }]));
}
