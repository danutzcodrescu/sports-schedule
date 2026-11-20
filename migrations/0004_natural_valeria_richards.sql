CREATE TABLE `preference_revision` (
	`user_id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
