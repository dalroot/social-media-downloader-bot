import { table, integer, text, sql } from 'sdk/db';

export const downloads = table('downloads', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').notNull(),
  shortcode: text('shortcode').notNull(),
  mediaType: text('media_type').default('video'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').unique().notNull(),
  lang: text('lang').default('en'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const channels = table('channels', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chat_id').unique().notNull(),
  title: text('title').notNull(),
  username: text('username'),
  inviteLink: text('invite_link'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const admins = table('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').unique().notNull(),
  role: text('role').default('superadmin'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

export const adminStates = table('admin_states', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: integer('chat_id').unique().notNull(),
  state: text('state').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});
