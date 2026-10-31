CREATE TABLE `cz_advertiser_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` varchar(40) NOT NULL,
	`months` int NOT NULL,
	`amountCents` int NOT NULL,
	`method` enum('yappy','transferencia','efectivo','otro') NOT NULL,
	`reference` varchar(120),
	`paidOn` varchar(10) NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_advertiser_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_advertiser_payment_reference_uq` UNIQUE(`method`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `cz_advertiser_plans` (
	`userId` int NOT NULL,
	`planId` varchar(40) NOT NULL,
	`endsAt` timestamp NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_advertiser_plans_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`status` enum('draft','published','paused','closed') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 0,
	`operation` enum('venta','alquiler') NOT NULL,
	`propertyType` enum('casa','apartamento','terreno','local','oficina') NOT NULL,
	`title` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`priceCents` bigint NOT NULL,
	`depositCents` bigint,
	`minLeaseMonths` int,
	`province` varchar(60) NOT NULL,
	`district` varchar(80) NOT NULL,
	`neighborhood` varchar(120) NOT NULL DEFAULT '',
	`areaBuiltM2` int,
	`areaLandM2` int,
	`bedrooms` int,
	`bathrooms` int,
	`parking` int,
	`floor` int,
	`furnished` int NOT NULL DEFAULT 0,
	`petsAllowed` int NOT NULL DEFAULT 0,
	`landUse` enum('residencial','comercial','agricola','mixto'),
	`hasTitle` int NOT NULL DEFAULT 0,
	`hasWater` int NOT NULL DEFAULT 0,
	`hasPower` int NOT NULL DEFAULT 0,
	`amenities` json,
	`advertiserType` enum('dueno','agente') NOT NULL DEFAULT 'dueno',
	`contactPhone` varchar(20) NOT NULL,
	`showPhone` int NOT NULL DEFAULT 1,
	`images` json,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_properties_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_properties_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `cz_advertiser_payments` ADD CONSTRAINT `cz_advertiser_payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_advertiser_payments` ADD CONSTRAINT `cz_advertiser_payments_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_advertiser_plans` ADD CONSTRAINT `cz_advertiser_plans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_properties` ADD CONSTRAINT `cz_properties_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_properties_search_idx` ON `cz_properties` (`status`,`operation`,`propertyType`,`province`);--> statement-breakpoint
CREATE INDEX `cz_properties_owner_idx` ON `cz_properties` (`userId`,`updatedAt`);