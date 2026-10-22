CREATE TABLE `cz_subscription_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`userId` int NOT NULL,
	`planId` varchar(32) NOT NULL,
	`months` int NOT NULL,
	`amountCents` int NOT NULL,
	`method` enum('yappy','transferencia','efectivo','otro') NOT NULL,
	`reference` varchar(120),
	`paidOn` varchar(10) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`recordedBy` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_subscription_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_subscription_payments_reference_uq` UNIQUE(`method`,`reference`)
);
--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `subscriptionPlanId` varchar(32);--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `subscriptionEndsAt` timestamp;--> statement-breakpoint
CREATE INDEX `cz_subscription_payments_app_idx` ON `cz_subscription_payments` (`applicationId`,`createdAt`);