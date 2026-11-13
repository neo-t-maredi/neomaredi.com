import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const posts = sqliteTable('writing_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  excerpt: text('excerpt').notNull().default(''),
  body: text('body').notNull().default(''),
  publishedTitle: text('published_title'),
  publishedExcerpt: text('published_excerpt'),
  publishedBody: text('published_body'),
  publishedMedia: text('published_media').notNull().default('[]'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  version: integer('version').notNull().default(1),
}, table => [index('idx_writing_posts_published_at').on(table.publishedAt)])

export const media = sqliteTable('writing_media', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull(),
  kind: text('kind').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdAt: text('created_at').notNull(),
}, table => [index('idx_writing_media_post_id').on(table.postId)])
