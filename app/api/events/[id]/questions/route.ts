import { userApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { uid } from '@/lib/util';
import { publish } from '@/lib/bus';
import { questionsFor } from '@/lib/events';

export const GET = userApi(async (_r, { params }, u) => ({ questions: await questionsFor(params.id, u.id) }));

export const POST = userApi(async (req, { params }, u) => {
  const ev = await db.query.events.findFirst({ where: eq(schema.events.id, params.id) });
  if (!ev) throw new HttpError(404, 'Event not found');
  const text = str((await body(req)).body, 400);
  if (!text) throw new HttpError(400, 'Question is empty');
  const id = uid();
  await db.insert(schema.questions).values({ id, eventId: ev.id, userId: u.id, body: text, status: 'open', createdAt: Date.now() });
  await db.insert(schema.questionVotes).values({ questionId: id, userId: u.id }).onConflictDoNothing();
  publish(`event:${ev.id}`, 'questions', { eventId: ev.id });
  return { id };
});
