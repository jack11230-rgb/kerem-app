import { userApi, adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { desc, eq } from 'drizzle-orm';
import { uid } from '@/lib/util';
import { libRow, libInput } from '@/lib/library';
import { summarizeLecture } from '@/lib/ai';

export const GET = userApi(async (req) => {
  const cat = new URL(req.url).searchParams.get('category');
  const rows = cat && cat !== 'all'
    ? await db.select().from(schema.libraryItems).where(eq(schema.libraryItems.category, cat)).orderBy(desc(schema.libraryItems.recordedAt))
    : await db.select().from(schema.libraryItems).orderBy(desc(schema.libraryItems.recordedAt));
  return { items: rows.map(libRow) };
});

export const POST = adminApi(async (req) => {
  const b = await body(req);
  const o = await libInput(b);
  if (!o.title || !o.speaker) throw new HttpError(400, 'Title and speaker are required');
  let method = 'editor';
  // auto-summarise if admin left summary/key points blank but gave a transcript/description
  if ((!o.summary || !o.keyPoints || o.keyPoints === '[]') && (o.transcript || o.summary)) {
    const s = await summarizeLecture(String(o.title), String(o.transcript || o.summary));
    if (!o.summary) o.summary = s.summary;
    if (!o.keyPoints || o.keyPoints === '[]') o.keyPoints = JSON.stringify(s.keyPoints);
    method = s.method;
  }
  const id = uid();
  await db.insert(schema.libraryItems).values({ id, ...(o as { title: string; speaker: string }), recordedAt: (o.recordedAt as number) ?? Date.now(), thumb: Math.floor(Math.random() * 6) + 1, summaryMethod: method, createdAt: Date.now() });
  return { id };
});
