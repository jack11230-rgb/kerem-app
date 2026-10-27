// One-time, idempotent cleanup: removes ONLY the leftover test member
// persistence-test-delete-me@example.com and rows that belong to it. Touches no other user.
// Safe to run on every boot; does nothing once the account is gone.
import { createClient } from '@libsql/client';

const EMAIL = 'persistence-test-delete-me@example.com';

async function main() {
  const url = process.env.DATABASE_URL || 'file:./data/kerem.db';
  const c = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const has = await c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
  if (has.rows.length === 0) { console.log('[cleanup] no users table yet; nothing to do'); return; }
  const u = await c.execute({ sql: 'SELECT id, name FROM users WHERE lower(email) = ?', args: [EMAIL] });
  if (u.rows.length === 0) { console.log(`[cleanup] test account ${EMAIL} not present; nothing to do`); return; }
  if (u.rows.length > 1) { console.log('[cleanup] unexpected: multiple matches, aborting'); return; }
  const id = String(u.rows[0].id);
  const tables = new Set((await c.execute("SELECT name FROM sqlite_master WHERE type='table'")).rows.map((r) => String(r.name)));
  const steps: [string, string, unknown[]][] = [
    ['question_votes on own questions', 'DELETE FROM question_votes WHERE question_id IN (SELECT id FROM questions WHERE user_id = ?)', [id]],
    ['question_votes', 'DELETE FROM question_votes WHERE user_id = ?', [id]],
    ['questions', 'DELETE FROM questions WHERE user_id = ?', [id]],
    ['sessions', 'DELETE FROM sessions WHERE user_id = ?', [id]],
    ['notes', 'DELETE FROM notes WHERE user_id = ?', [id]],
    ['notifications', 'DELETE FROM notifications WHERE user_id = ?', [id]],
    ['rsvps', 'DELETE FROM rsvps WHERE user_id = ?', [id]],
    ['attendance', 'DELETE FROM attendance WHERE user_id = ?', [id]],
    ['room_members', 'DELETE FROM room_members WHERE user_id = ?', [id]],
    ['messages', 'DELETE FROM messages WHERE user_id = ?', [id]],
    ['invites (created_by -> NULL)', 'UPDATE invites SET created_by = NULL WHERE created_by = ?', [id]],
    ['users', 'DELETE FROM users WHERE id = ? AND lower(email) = ?', [id, EMAIL]],
  ];
  const tx = await c.transaction('write');
  const report: string[] = [];
  try {
    for (const [label, sql, args] of steps) {
      const table = label.split(' ')[0];
      if (!tables.has(table)) continue;
      const r = await tx.execute({ sql, args: args as never });
      report.push(`${label}=${r.rowsAffected}`);
    }
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
  console.log(`[cleanup] removed test account ${EMAIL} (id ${id}, "${u.rows[0].name}"): ${report.join(', ')}`);
}

main().catch((e) => { console.error('[cleanup] failed (non-fatal):', e); });
