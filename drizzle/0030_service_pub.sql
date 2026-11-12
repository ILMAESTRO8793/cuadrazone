CREATE TABLE `cz_service_pub` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` varchar(12) NOT NULL DEFAULT 'requested',
	`message` varchar(500) NOT NULL DEFAULT '',
	`activeUntil` timestamp,
	`requestedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_service_pub_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_service_pub_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_service_pub_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`months` int NOT NULL,
	`amountCents` int NOT NULL,
	`method` enum('yappy','transferencia','tarjeta','efectivo','otro') NOT NULL,
	`reference` varchar(120),
	`paidOn` varchar(10) NOT NULL,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_service_pub_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_service_pub_payment_reference_uq` UNIQUE(`method`,`reference`)
);
--> statement-breakpoint
ALTER TABLE `cz_service_pub` ADD CONSTRAINT `cz_service_pub_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_service_pub_payments` ADD CONSTRAINT `cz_service_pub_payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_service_pub_payments` ADD CONSTRAINT `cz_service_pub_payments_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_service_pub_payment_user_ix` ON `cz_service_pub_payments` (`userId`,`createdAt`);