CREATE TABLE `cz_email_outbox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dedupeKey` varchar(191) NOT NULL,
	`toEmail` varchar(320) NOT NULL,
	`toName` varchar(200),
	`subject` varchar(300) NOT NULL,
	`html` text NOT NULL,
	`textBody` text NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`attempts` int NOT NULL DEFAULT 0,
	`lastError` varchar(500),
	`sendAfter` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_email_outbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_email_outbox_dedupe_uq` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE INDEX `cz_email_outbox_queue_idx` ON `cz_email_outbox` (`status`,`sendAfter`);