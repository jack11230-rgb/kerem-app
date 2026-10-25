import { publicApi, body, str } from '@/lib/api';
import { checkInvite } from '@/lib/invites';
export const POST = publicApi(async (req) => {
  const b = await body(req);
  const r = await checkInvite(str(b.code, 20));
  if (!r.valid) return { valid: false, reason: r.reason };
  return { valid: true, email: r.invite.email ?? null, note: r.invite.note };
});
