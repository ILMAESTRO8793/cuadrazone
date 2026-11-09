CREATE TABLE `cz_event_ticket_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`priceCents` int NOT NULL DEFAULT 0,
	`capacity` int NOT NULL,
	`taken` int NOT NULL DEFAULT 0,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `cz_event_ticket_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`status` enum('draft','published','cancelled') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 0,
	`title` varchar(140) NOT NULL,
	`artist` varchar(140) NOT NULL DEFAULT '',
	`description` text NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp,
	`venueName` varchar(140) NOT NULL,
	`address` varchar(240) NOT NULL DEFAULT '',
	`province` varchar(60) NOT NULL,
	`city` varchar(80) NOT NULL DEFAULT '',
	`mapUrl` varchar(500) NOT NULL DEFAULT '',
	`images` json,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_events_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cz_ticket_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` int NOT NULL,
	`ticketTypeId` int NOT NULL,
	`storeId` int NOT NULL,
	`buyerUserId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`totalCents` int NOT NULL,
	`status` enum('reserved','paid','cancelled') NOT NULL DEFAULT 'reserved',
	`buyerName` varchar(120) NOT NULL,
	`buyerPhone` varchar(20) NOT NULL,
	`commissionBps` int NOT NULL DEFAULT 0,
	`commissionCents` int NOT NULL DEFAULT 0,
	`commissionPaymentId` int,
	`expiresAt` timestamp,
	`paidAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_ticket_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`eventId` int NOT NULL,
	`ticketTypeId` int NOT NULL,
	`holderUserId` int NOT NULL,
	`code` varchar(32) NOT NULL,
	`status` enum('valid','used','cancelled') NOT NULL DEFAULT 'valid',
	`usedAt` timestamp,
	`usedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_tickets_code_uq` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `cz_event_ticket_types` ADD CONSTRAINT `cz_event_ticket_types_eventId_cz_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `cz_events`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_events` ADD CONSTRAINT `cz_events_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_events` ADD CONSTRAINT `cz_events_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_ticket_orders` ADD CONSTRAINT `cz_ticket_orders_eventId_cz_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `cz_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_ticket_orders` ADD CONSTRAINT `cz_ticket_orders_ticketTypeId_cz_event_ticket_types_id_fk` FOREIGN KEY (`ticketTypeId`) REFERENCES `cz_event_ticket_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_ticket_orders` ADD CONSTRAINT `cz_ticket_orders_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_ticket_orders` ADD CONSTRAINT `cz_ticket_orders_buyerUserId_users_id_fk` FOREIGN KEY (`buyerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_tickets` ADD CONSTRAINT `cz_tickets_orderId_cz_ticket_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_ticket_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_tickets` ADD CONSTRAINT `cz_tickets_eventId_cz_events_id_fk` FOREIGN KEY (`eventId`) REFERENCES `cz_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_tickets` ADD CONSTRAINT `cz_tickets_ticketTypeId_cz_event_ticket_types_id_fk` FOREIGN KEY (`ticketTypeId`) REFERENCES `cz_event_ticket_types`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_tickets` ADD CONSTRAINT `cz_tickets_holderUserId_users_id_fk` FOREIGN KEY (`holderUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_event_ticket_types_event_ix` ON `cz_event_ticket_types` (`eventId`);--> statement-breakpoint
CREATE INDEX `cz_events_store_ix` ON `cz_events` (`storeId`);--> statement-breakpoint
CREATE INDEX `cz_events_public_ix` ON `cz_events` (`status`,`startsAt`);--> statement-breakpoint
CREATE INDEX `cz_ticket_orders_event_ix` ON `cz_ticket_orders` (`eventId`,`status`);--> statement-breakpoint
CREATE INDEX `cz_ticket_orders_buyer_ix` ON `cz_ticket_orders` (`buyerUserId`);--> statement-breakpoint
CREATE INDEX `cz_ticket_orders_store_ix` ON `cz_ticket_orders` (`storeId`,`status`,`paidAt`);--> statement-breakpoint
CREATE INDEX `cz_ticket_orders_commission_ix` ON `cz_ticket_orders` (`storeId`,`commissionPaymentId`);--> statement-breakpoint
CREATE INDEX `cz_ticket_orders_expiry_ix` ON `cz_ticket_orders` (`status`,`expiresAt`);--> statement-breakpoint
CREATE INDEX `cz_tickets_event_ix` ON `cz_tickets` (`eventId`,`status`);--> statement-breakpoint
CREATE INDEX `cz_tickets_holder_ix` ON `cz_tickets` (`holderUserId`);