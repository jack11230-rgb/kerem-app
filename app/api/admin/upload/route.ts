import { adminApi, HttpError } from '@/lib/api';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { uid } from '@/lib/util';
import { UPLOAD_DIR, MEDIA_TYPES } from '@/lib/media';

export const runtime = 'nodejs';
export const POST = adminApi(async (req) => {
  const fd = await req.formData();
  const f = fd.get('file');
  if (!f || typeof f === 'string') throw new HttpError(400, 'No file uploaded');
  const ext = path.extname(f.name).toLowerCase();
  if (!MEDIA_TYPES[ext]) throw new HttpError(400, 'Allowed: mp4, webm, mov, mp3, m4a, ogg, wav, pdf');
  if (f.size > 500 * 1024 * 1024) throw new HttpError(413, 'Max 500 MB');
  await mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${uid()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await f.arrayBuffer()));
  return { url: `/api/media/${name}`, mediaType: MEDIA_TYPES[ext].startsWith('audio') ? 'audio' : 'video' };
});
