CREATE TABLE `cz_service_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`requesterUserId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`preferredDate` varchar(10) NOT NULL DEFAULT '',
	`province` varchar(60) NOT NULL,
	`status` enum('nueva','contactada','cerrada') NOT NULL DEFAULT 'nueva',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_service_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`status` enum('draft','published','paused') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 0,
	`title` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`serviceType` varchar(20) NOT NULL,
	`categoryId` varchar(80) NOT NULL,
	`specialtyId` varchar(120),
	`priceType` varchar(20) NOT NULL,
	`priceCents` int,
	`durationMinutes` int,
	`modalities` json NOT NULL,
	`coverageProvinces` json,
	`schedule` varchar(300) NOT NULL DEFAULT '',
	`images` json,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_services_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `storeKind` varchar(20) DEFAULT 'comercio' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `condition` varchar(20) DEFAULT 'nuevo' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `brand` varchar(80) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `weightGrams` int;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `lengthCm` int;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `widthCm` int;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `heightCm` int;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `warranty` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_products` ADD `videos` json;--> statement-breakpoint
ALTER TABLE `cz_stores` ADD `storeKind` varchar(20) DEFAULT 'comercio' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_service_requests` ADD CONSTRAINT `cz_service_requests_serviceId_cz_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `cz_services`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_service_requests` ADD CONSTRAINT `cz_service_requests_requesterUserId_users_id_fk` FOREIGN KEY (`requesterUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_services` ADD CONSTRAINT `cz_services_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_services` ADD CONSTRAINT `cz_services_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_service_requests_service_ix` ON `cz_service_requests` (`serviceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_services_store_ix` ON `cz_services` (`storeId`);--> statement-breakpoint
CREATE INDEX `cz_services_search_ix` ON `cz_services` (`status`,`serviceType`,`categoryId`);