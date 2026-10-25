import { adminApi, body, str, HttpError } from '@/lib/api';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { inviteCode } from '@/lib/util';
export const POST = adminApi(async (req, _c, u) => {
  const b = await body(req);
  const code = str(b.code, 12).toUpperCase().replace(/[^A-Z0-9]/g, '') || inviteCode();
  if (code.length !== 6) throw new HttpError(400, 'Codes are exactly 6 letters/digits');
  if (await db.query.invites.findFirst({ where: eq(schema.invites.code, code) })) throw new HttpError(409, 'That code already exists');
  const days = Number(b.expiresDays) || 0;
  await db.insert(schema.invites).values({ code, createdBy: u.id, note: str(b.note, 200), email: str(b.email, 200).toLowerCase() || null, maxUses: Math.max(1, Math.min(500, Number(b.maxUses) || 1)), uses: 0, role: b.role === 'admin' ? 'admin' : 'member', expiresAt: days ? Date.now() + days * 86400_000 : null, createdAt: Date.now() });
  return { code };
});
