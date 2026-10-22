CREATE TABLE `cz_commission_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sellerUserId` int NOT NULL,
	`amountCents` int NOT NULL,
	`orderCount` int NOT NULL,
	`method` enum('yappy','transferencia','efectivo','otro') NOT NULL,
	`reference` varchar(120),
	`paidOn` varchar(10) NOT NULL,
	`recordedBy` int NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_commission_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_commission_payment_reference_uq` UNIQUE(`method`,`reference`)
);
--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `trialEndsAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD `commissionBps` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD `commissionCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD `commissionPaymentId` int;--> statement-breakpoint
ALTER TABLE `cz_commission_payments` ADD CONSTRAINT `cz_commission_payments_sellerUserId_users_id_fk` FOREIGN KEY (`sellerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_commission_payments` ADD CONSTRAINT `cz_commission_payments_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_commission_payment_seller_ix` ON `cz_commission_payments` (`sellerUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_order_commission_ix` ON `cz_orders` (`storeId`,`status`,`commissionPaymentId`);