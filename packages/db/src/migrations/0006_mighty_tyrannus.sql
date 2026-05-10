CREATE TABLE `bot_qr_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_instance_id` text NOT NULL,
	`token` text NOT NULL,
	`token_hash` text NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`bot_instance_id`) REFERENCES `bot_instances`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bot_qr_shares_bot_instance_id_idx` ON `bot_qr_shares` (`bot_instance_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bot_qr_shares_token_idx` ON `bot_qr_shares` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `bot_qr_shares_token_hash_idx` ON `bot_qr_shares` (`token_hash`);--> statement-breakpoint
CREATE INDEX `bot_qr_shares_revoked_at_idx` ON `bot_qr_shares` (`revoked_at`);--> statement-breakpoint
ALTER TABLE `bot_instances` ADD `qr_reissue_requested_at` integer;