CREATE TABLE `writing_media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_writing_media_post_id` ON `writing_media` (`post_id`);--> statement-breakpoint
ALTER TABLE `writing_posts` ADD `published_media` text DEFAULT '[]' NOT NULL;