import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { listMessages, roomMemberList, getHall } from '@/lib/chat';
import { presenceCount } from '@/lib/bus';

export const GET = userApi(async (_r, { params }) => {
  const room = params.id === 'hall' ? await getHall() : await db.query.rooms.findFirst({ where: eq(schema.rooms.id, params.id) });
  if (!room) throw new HttpError(404, 'Room not found');
  const members = room.kind === 'hall' ? [] : await roomMemberList(room.id);
  const totalMembers = (await db.select({ id: schema.users.id }).from(schema.users)).length;
  return { room, members, totalMembers, online: presenceCount('app'), messages: await listMessages(room.id) };
});
