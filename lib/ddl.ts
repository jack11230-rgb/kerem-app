// Plain SQL DDL so the app can self-create its SQLite schema on first boot.
// For Postgres in production, generate migrations with drizzle-kit from a pg-core schema instead.
export const DDL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, initials TEXT NOT NULL, color INTEGER NOT NULL DEFAULT 1, role TEXT NOT NULL DEFAULT 'member', title TEXT DEFAULT 'Member', bio TEXT DEFAULT '', interests TEXT DEFAULT '[]', is_demo INTEGER NOT NULL DEFAULT 0, last_seen_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, created_by TEXT, note TEXT DEFAULT '', email TEXT, max_uses INTEGER NOT NULL DEFAULT 1, uses INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'member', expires_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, sponsor TEXT DEFAULT '', reason TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', invite_code TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, speaker TEXT NOT NULL, series TEXT DEFAULT '', kind TEXT NOT NULL DEFAULT 'lecture', description TEXT DEFAULT '', starts_at INTEGER NOT NULL, ends_at INTEGER, location TEXT DEFAULT '', online_url TEXT DEFAULT '', stream_url TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'scheduled', live_started_at INTEGER, ended_at INTEGER, summary TEXT, library_item_id TEXT, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rsvps (event_id TEXT NOT NULL, user_id TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (event_id, user_id));
CREATE TABLE IF NOT EXISTS attendance (event_id TEXT NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (event_id, user_id));
CREATE TABLE IF NOT EXISTS library_items (id TEXT PRIMARY KEY, title TEXT NOT NULL, speaker TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'lecture', media_type TEXT NOT NULL DEFAULT 'video', media_url TEXT DEFAULT '', duration TEXT DEFAULT '', recorded_at INTEGER NOT NULL, summary TEXT DEFAULT '', key_points TEXT DEFAULT '[]', transcript TEXT DEFAULT '', thumb INTEGER NOT NULL DEFAULT 1, event_id TEXT, summary_method TEXT DEFAULT 'editor', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, library_item_id TEXT, event_id TEXT, text TEXT NOT NULL, ts TEXT DEFAULT '', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, topic TEXT DEFAULT '', event_id TEXT, parent_room_id TEXT, status TEXT NOT NULL DEFAULT 'active', detected_by TEXT, last_activity_at INTEGER NOT NULL, archived_at INTEGER, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS room_members (room_id TEXT NOT NULL, user_id TEXT NOT NULL, joined_at INTEGER NOT NULL, PRIMARY KEY (room_id, user_id));
CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, room_id TEXT NOT NULL, user_id TEXT, kind TEXT NOT NULL DEFAULT 'text', body TEXT NOT NULL, meta TEXT, fact_check TEXT, moved_to_room_id TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id, created_at);
CREATE TABLE IF NOT EXISTS questions (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, user_id TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS question_votes (question_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (question_id, user_id));
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT DEFAULT '', link TEXT DEFAULT '', dedupe_key TEXT, read_at INTEGER, created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_dedupe ON notifications(user_id, dedupe_key);
`;
