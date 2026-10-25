import { publicApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { uid } from '@/lib/util';
import { notifyAdmins } from '@/lib/notify';

export const POST = publicApi(async (req) => {
  const b = await body(req);
  const name = str(b.name, 80), email = str(b.email, 200).toLowerCase();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Please enter your name and a valid email');
  await db.insert(schema.applications).values({ id: uid(), name, email, sponsor: str(b.sponsor, 80), reason: str(b.reason, 1000), status: 'pending', createdAt: Date.now() });
  await notifyAdmins({ kind: 'application', title: 'New membership application', body: `${name}${b.sponsor ? ` · sponsored by ${str(b.sponsor, 80)}` : ''}`, link: '/admin' });
  return { ok: true };
});
