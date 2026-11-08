CREATE TABLE `cz_payment_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`userId` int NOT NULL,
	`concept` enum('subscription','commission','both') NOT NULL,
	`planId` varchar(32),
	`months` int,
	`subscriptionCents` int NOT NULL DEFAULT 0,
	`commissionCents` int NOT NULL DEFAULT 0,
	`commissionCutoff` timestamp,
	`amountCents` int NOT NULL,
	`method` enum('yappy','transferencia','tarjeta') NOT NULL,
	`reference` varchar(120) NOT NULL,
	`paidOn` varchar(10) NOT NULL,
	`note` text,
	`receiptName` varchar(200) NOT NULL,
	`receiptMime` varchar(80) NOT NULL,
	`receiptSize` int NOT NULL,
	`receiptBytes` mediumblob NOT NULL,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`reviewedBy` int,
	`reviewedAt` timestamp,
	`rejectReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_payment_claims_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cz_subscription_payments` MODIFY COLUMN `method` enum('yappy','transferencia','tarjeta','efectivo','otro') NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_commission_payments` MODIFY COLUMN `method` enum('yappy','transferencia','tarjeta','efectivo','otro') NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `holdReason` varchar(16);--> statement-breakpoint
ALTER TABLE `cz_payment_claims` ADD CONSTRAINT `cz_payment_claims_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_payment_claims_status_idx` ON `cz_payment_claims` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_payment_claims_user_idx` ON `cz_payment_claims` (`userId`,`createdAt`);