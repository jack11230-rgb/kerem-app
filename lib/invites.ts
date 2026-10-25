import { db, schema } from './db';
import { eq } from 'drizzle-orm';
export async function checkInvite(codeRaw: string) {
  const code = codeRaw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const inv = await db.query.invites.findFirst({ where: eq(schema.invites.code, code) });
  if (!inv) return { valid: false as const, reason: 'That invitation code was not found' };
  if (inv.uses >= inv.maxUses) return { valid: false as const, reason: 'This invitation has already been used' };
  if (inv.expiresAt && inv.expiresAt < Date.now()) return { valid: false as const, reason: 'This invitation has expired' };
  return { valid: true as const, invite: inv };
}
