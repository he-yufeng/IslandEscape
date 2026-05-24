CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `saves` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`turn` integer DEFAULT 0 NOT NULL,
	`snapshot` text NOT NULL,
	`updated_at` text NOT NULL
);
