CREATE TABLE `cz_claims` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`buyerUserId` int NOT NULL,
	`sellerUserId` int NOT NULL,
	`storeId` int,
	`reason` enum('not_received','damaged','not_as_described','wrong_item','other') NOT NULL,
	`description` text NOT NULL,
	`status` enum('open','answered','resolved') NOT NULL DEFAULT 'open',
	`respondBy` timestamp NOT NULL,
	`sellerResponse` text,
	`sellerRespondedAt` timestamp,
	`resolution` enum('buyer_favor','seller_favor','agreement','withdrawn'),
	`resolutionNote` text,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_claims_order_uq` UNIQUE(`orderId`)
);
--> statement-breakpoint
ALTER TABLE `cz_events` ADD `moderatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_events` ADD `moderationReason` varchar(300);--> statement-breakpoint
ALTER TABLE `cz_products` ADD `moderatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `moderationReason` varchar(300);--> statement-breakpoint
ALTER TABLE `cz_services` ADD `moderatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_services` ADD `moderationReason` varchar(300);--> statement-breakpoint
ALTER TABLE `cz_reviews` ADD `hiddenAt` timestamp;--> statement-breakpoint
ALTER TABLE `cz_reviews` ADD `hiddenReason` varchar(300);--> statement-breakpoint
ALTER TABLE `cz_claims` ADD CONSTRAINT `cz_claims_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_claims` ADD CONSTRAINT `cz_claims_buyerUserId_users_id_fk` FOREIGN KEY (`buyerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_claims` ADD CONSTRAINT `cz_claims_sellerUserId_users_id_fk` FOREIGN KEY (`sellerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_claims` ADD CONSTRAINT `cz_claims_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_claims` ADD CONSTRAINT `cz_claims_resolvedBy_users_id_fk` FOREIGN KEY (`resolvedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_claims_status_ix` ON `cz_claims` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_claims_seller_ix` ON `cz_claims` (`sellerUserId`,`status`);