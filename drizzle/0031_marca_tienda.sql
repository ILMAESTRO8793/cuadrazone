CREATE TABLE `cz_store_branding` (
	`storeId` int NOT NULL,
	`coverUrl` varchar(500),
	`tagline` varchar(90) NOT NULL DEFAULT '',
	`brandColor` varchar(7) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_store_branding_storeId` PRIMARY KEY(`storeId`)
);
--> statement-breakpoint
ALTER TABLE `cz_store_branding` ADD CONSTRAINT `cz_store_branding_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;