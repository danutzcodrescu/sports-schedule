CREATE TABLE `favourite_team` (
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`league_id` text NOT NULL,
	`team_name` text NOT NULL,
	`country` text,
	`badge_url` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`user_id`, `team_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`league_id`) REFERENCES `league`(`id`) ON UPDATE no action ON DELETE cascade
);
