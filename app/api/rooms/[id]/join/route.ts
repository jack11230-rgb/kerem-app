import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { joinRoom, roomMemberList } from '@/lib/chat';
export const POST = userApi(async (_r, { params }, u) => {
  const room = await db.query.rooms.findFirst({ where: eq(schema.rooms.id, params.id) });
  if (!room || room.kind !== 'side') throw new HttpError(404, 'Room not found');
  await joinRoom(room.id, u.id);
  return { members: await roomMemberList(room.id) };
});
