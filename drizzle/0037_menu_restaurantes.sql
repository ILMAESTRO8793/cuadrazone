CREATE TABLE `cz_menu_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`sectionId` int NOT NULL,
	`name` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`imageUrl` varchar(500),
	`priceCents` int NOT NULL,
	`available` int NOT NULL DEFAULT 1,
	`tags` json NOT NULL,
	`sizes` json NOT NULL,
	`optionGroups` json NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_menu_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_menu_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`name` varchar(60) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	CONSTRAINT `cz_menu_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_restaurants` (
	`storeId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`prepMinutes` int NOT NULL DEFAULT 25,
	`hours` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_restaurants_storeId` PRIMARY KEY(`storeId`)
);
--> statement-breakpoint
ALTER TABLE `cz_menu_items` ADD CONSTRAINT `cz_menu_items_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_menu_items` ADD CONSTRAINT `cz_menu_items_sectionId_cz_menu_sections_id_fk` FOREIGN KEY (`sectionId`) REFERENCES `cz_menu_sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_menu_sections` ADD CONSTRAINT `cz_menu_sections_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_restaurants` ADD CONSTRAINT `cz_restaurants_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_menu_items_store_ix` ON `cz_menu_items` (`storeId`);--> statement-breakpoint
CREATE INDEX `cz_menu_sections_store_ix` ON `cz_menu_sections` (`storeId`);