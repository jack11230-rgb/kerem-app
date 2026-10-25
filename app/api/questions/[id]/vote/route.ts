import { userApi, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { publish } from '@/lib/bus';

export const POST = userApi(async (_r, { params }, u) => {
  const q = await db.query.questions.findFirst({ where: eq(schema.questions.id, params.id) });
  if (!q) throw new HttpError(404, 'Question not found');
  const w = and(eq(schema.questionVotes.questionId, q.id), eq(schema.questionVotes.userId, u.id));
  const had = await db.query.questionVotes.findFirst({ where: w });
  if (had) await db.delete(schema.questionVotes).where(w);
  else await db.insert(schema.questionVotes).values({ questionId: q.id, userId: u.id });
  publish(`event:${q.eventId}`, 'questions', { eventId: q.eventId });
  return { voted: !had };
});
