CREATE TABLE `cz_store_links` (
	`storeId` int NOT NULL,
	`url` varchar(300) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_store_links_storeId` PRIMARY KEY(`storeId`)
);
--> statement-breakpoint
ALTER TABLE `cz_store_links` ADD CONSTRAINT `cz_store_links_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;