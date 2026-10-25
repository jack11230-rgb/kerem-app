import { adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { and, eq } from 'drizzle-orm';
import { publish } from '@/lib/bus';

export const PATCH = adminApi(async (req, { params }) => {
  const q = await db.query.questions.findFirst({ where: eq(schema.questions.id, params.id) });
  if (!q) throw new HttpError(404, 'Question not found');
  const status = str((await body(req)).status, 12);
  if (!['open', 'answering', 'answered'].includes(status)) throw new HttpError(400, 'bad status');
  if (status === 'answering') await db.update(schema.questions).set({ status: 'answered' }).where(and(eq(schema.questions.eventId, q.eventId), eq(schema.questions.status, 'answering')));
  await db.update(schema.questions).set({ status }).where(eq(schema.questions.id, q.id));
  publish(`event:${q.eventId}`, 'questions', { eventId: q.eventId });
  return { ok: true };
});
