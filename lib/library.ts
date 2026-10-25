import { schema } from './db';
import { str, HttpError } from './api';
import { parseJSON } from './util';

export function libRow(r: typeof schema.libraryItems.$inferSelect) {
  return { ...r, keyPoints: parseJSON<{ text: string; ts: string }[]>(r.keyPoints, []) };
}

export async function libInput(b: Record<string, unknown>) {
  const o: Record<string, unknown> = {};
  for (const [k, m] of [['title', 200], ['speaker', 120], ['mediaUrl', 600], ['duration', 20], ['summary', 2000], ['transcript', 100000]] as const) if (b[k] !== undefined) o[k] = str(b[k], m);
  if (b.category !== undefined) o.category = ['shiur', 'lecture', 'philosophy'].includes(String(b.category)) ? b.category : 'lecture';
  if (b.mediaType !== undefined) o.mediaType = ['video', 'audio', 'none'].includes(String(b.mediaType)) ? b.mediaType : 'video';
  if (o.mediaUrl && !/^(https?:\/\/|\/api\/media\/)/i.test(String(o.mediaUrl))) throw new HttpError(400, 'Media URL must start with http(s)://');
  if (b.recordedAt) { const v = Date.parse(String(b.recordedAt)); if (!Number.isNaN(v)) o.recordedAt = v; }
  if (Array.isArray(b.keyPoints)) o.keyPoints = JSON.stringify((b.keyPoints as { text?: string; ts?: string }[]).filter((k) => k?.text).map((k) => ({ text: str(k.text, 300), ts: str(k.ts ?? '', 10) })));
  return o;
}

