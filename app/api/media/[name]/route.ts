import { NextRequest } from 'next/server';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { UPLOAD_DIR, MEDIA_TYPES } from '@/lib/media';
import { getUser } from '@/lib/auth';
import { ensureDb } from '@/lib/db';

export const runtime = 'nodejs';
export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  await ensureDb();
  if (!(await getUser())) return new Response('Unauthorized', { status: 401 });
  const { name } = await params;
  if (!/^[A-Za-z0-9_-]+\.[a-z0-9]+$/.test(name)) return new Response('Not found', { status: 404 });
  const file = path.join(UPLOAD_DIR, name);
  const st = await stat(file).catch(() => null);
  if (!st) return new Response('Not found', { status: 404 });
  const type = MEDIA_TYPES[path.extname(name)] ?? 'application/octet-stream';
  const range = req.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
    if (start >= st.size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    const s = Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream;
    return new Response(s, { status: 206, headers: { 'Content-Type': type, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes' } });
  }
  const s = Readable.toWeb(createReadStream(file)) as ReadableStream;
  return new Response(s, { headers: { 'Content-Type': type, 'Content-Length': String(st.size), 'Accept-Ranges': 'bytes' } });
}
