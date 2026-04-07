CREATE TABLE `pr_messages` (
	`pr_key` text PRIMARY KEY NOT NULL,
	`slack_ts` text NOT NULL,
	`slack_channel` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updated_at` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
