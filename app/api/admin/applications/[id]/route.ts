import { adminApi, body, str, HttpError } from '@/lib/api';
import { db, schema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { inviteCode } from '@/lib/util';
export const POST = adminApi(async (req, { params }, u) => {
  const a = await db.query.applications.findFirst({ where: eq(schema.applications.id, params.id) });
  if (!a) throw new HttpError(404, 'Application not found');
  const action = str((await body(req)).action, 10);
  if (action === 'decline') { await db.update(schema.applications).set({ status: 'declined' }).where(eq(schema.applications.id, a.id)); return { ok: true }; }
  if (action !== 'approve') throw new HttpError(400, 'bad action');
  const code = a.inviteCode || inviteCode();
  if (!a.inviteCode) await db.insert(schema.invites).values({ code, createdBy: u.id, note: `Application: ${a.name}`, email: a.email, maxUses: 1, uses: 0, role: 'member', expiresAt: Date.now() + 30 * 86400_000, createdAt: Date.now() });
  await db.update(schema.applications).set({ status: 'approved', inviteCode: code }).where(eq(schema.applications.id, a.id));
  return { ok: true, code };
});
