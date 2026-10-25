// OWNER_EMAILS: comma-separated emails that are always admins. Applied on signup, on login and at start (seed).
// Useful on hosts with an ephemeral DB, where data (and roles) reset on every restart.
export function ownerEmails(raw = process.env.OWNER_EMAILS || ''): string[] {
  return raw.split(/[,\s;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isOwnerEmail(email: string | null | undefined, raw?: string): boolean {
  if (!email) return false;
  return ownerEmails(raw).includes(email.trim().toLowerCase());
}
