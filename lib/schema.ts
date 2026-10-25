import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: integer('color').notNull().default(1),
  role: text('role').notNull().default('member'), // member | admin
  title: text('title').default('Member'),
  bio: text('bio').default(''),
  interests: text('interests').default('[]'), // JSON string[]
  isDemo: integer('is_demo').notNull().default(0),
  lastSeenAt: integer('last_seen_at'),
  createdAt: integer('created_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: integer('expires_at').notNull(),
});

export const invites = sqliteTable('invites', {
  code: text('code').primaryKey(),
  createdBy: text('created_by'),
  note: text('note').default(''),
  email: text('email'), // optional: restrict to this email
  maxUses: integer('max_uses').notNull().default(1),
  uses: integer('uses').notNull().default(0),
  role: text('role').notNull().default('member'),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull(),
});

export const applications = sqliteTable('applications', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  sponsor: text('sponsor').default(''),
  reason: text('reason').default(''),
  status: text('status').notNull().default('pending'), // pending | approved | declined
  inviteCode: text('invite_code'),
  createdAt: integer('created_at').notNull(),
});

export const events = sqliteTable('events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  speaker: text('speaker').notNull(),
  series: text('series').default(''),
  kind: text('kind').notNull().default('lecture'), // shiur | lecture | philosophy
  description: text('description').default(''),
  startsAt: integer('starts_at').notNull(),
  endsAt: integer('ends_at'),
  location: text('location').default(''),
  onlineUrl: text('online_url').default(''),
  streamUrl: text('stream_url').default(''),
  status: text('status').notNull().default('scheduled'), // scheduled | live | ended
  liveStartedAt: integer('live_started_at'),
  endedAt: integer('ended_at'),
  summary: text('summary'), // JSON DiscussionSummary
  libraryItemId: text('library_item_id'),
  createdAt: integer('created_at').notNull(),
});

export const rsvps = sqliteTable('rsvps', {
  eventId: text('event_id').notNull(),
  userId: text('user_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] })]);

export const attendance = sqliteTable('attendance', {
  eventId: text('event_id').notNull(),
  userId: text('user_id').notNull(),
  at: integer('at').notNull(),
}, (t) => [primaryKey({ columns: [t.eventId, t.userId] })]);

export const libraryItems = sqliteTable('library_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  speaker: text('speaker').notNull(),
  category: text('category').notNull().default('lecture'), // shiur | lecture | philosophy
  mediaType: text('media_type').notNull().default('video'), // video | audio | none
  mediaUrl: text('media_url').default(''),
  duration: text('duration').default(''),
  recordedAt: integer('recorded_at').notNull(),
  summary: text('summary').default(''),
  keyPoints: text('key_points').default('[]'), // JSON {text, ts}[]
  transcript: text('transcript').default(''),
  thumb: integer('thumb').notNull().default(1),
  eventId: text('event_id'),
  summaryMethod: text('summary_method').default('editor'), // editor | ai | extractive
  createdAt: integer('created_at').notNull(),
});

export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  libraryItemId: text('library_item_id'),
  eventId: text('event_id'),
  text: text('text').notNull(),
  ts: text('ts').default(''),
  createdAt: integer('created_at').notNull(),
});

export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // hall | side | live
  title: text('title').notNull(),
  topic: text('topic').default(''),
  eventId: text('event_id'),
  parentRoomId: text('parent_room_id'),
  status: text('status').notNull().default('active'), // active | archived
  detectedBy: text('detected_by'), // ai | heuristic | manual
  lastActivityAt: integer('last_activity_at').notNull(),
  archivedAt: integer('archived_at'),
  createdAt: integer('created_at').notNull(),
});

export const roomMembers = sqliteTable('room_members', {
  roomId: text('room_id').notNull(),
  userId: text('user_id').notNull(),
  joinedAt: integer('joined_at').notNull(),
}, (t) => [primaryKey({ columns: [t.roomId, t.userId] })]);

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  roomId: text('room_id').notNull(),
  userId: text('user_id'),
  kind: text('kind').notNull().default('text'), // text | system | roomcard | recap
  body: text('body').notNull(),
  meta: text('meta'), // JSON
  factCheck: text('fact_check'), // JSON FactCheck
  movedToRoomId: text('moved_to_room_id'),
  createdAt: integer('created_at').notNull(),
});

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  eventId: text('event_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'), // open | answering | answered
  createdAt: integer('created_at').notNull(),
});

export const questionVotes = sqliteTable('question_votes', {
  questionId: text('question_id').notNull(),
  userId: text('user_id').notNull(),
}, (t) => [primaryKey({ columns: [t.questionId, t.userId] })]);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  body: text('body').default(''),
  link: text('link').default(''),
  dedupeKey: text('dedupe_key'),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull(),
});
