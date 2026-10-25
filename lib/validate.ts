import { str, HttpError } from './api';
export function eventInput(b: Record<string, unknown>, partial = false) {
  const o: Record<string, unknown> = {};
  const s = (k: string, max = 500) => { if (b[k] !== undefined) o[k] = str(b[k], max); };
  s('title', 200); s('speaker', 120); s('series', 120); s('description', 4000); s('location', 200); s('onlineUrl', 500); s('streamUrl', 500);
  if (b.kind !== undefined) { const k = str(b.kind, 20); o.kind = ['shiur', 'lecture', 'philosophy'].includes(k) ? k : 'lecture'; }
  for (const k of ['startsAt', 'endsAt']) if (b[k] !== undefined && b[k] !== '') {
    const v = typeof b[k] === 'number' ? (b[k] as number) : Date.parse(String(b[k]));
    if (Number.isNaN(v)) throw new HttpError(400, `Invalid ${k}`);
    o[k] = v;
  }
  for (const k of ['onlineUrl', 'streamUrl']) if (o[k] && !/^https?:\/\//i.test(String(o[k]))) throw new HttpError(400, `${k} must start with http(s)://`);
  if (!partial && (!o.title || !o.speaker || !o.startsAt)) throw new HttpError(400, 'Title, speaker and start time are required');
  return o;
}
