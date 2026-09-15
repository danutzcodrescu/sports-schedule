CREATE TABLE `league` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sport_name` text NOT NULL,
	`country` text,
	`badge_url` text,
	`synced_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `followed_league` (
	`user_id` text NOT NULL,
	`league_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `league_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `followed_league_user_id_idx` ON `followed_league` (`user_id`);
