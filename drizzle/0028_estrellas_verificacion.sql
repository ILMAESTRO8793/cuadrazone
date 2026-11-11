CREATE TABLE `cz_store_stars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`star` varchar(16) NOT NULL,
	`note` varchar(300) NOT NULL DEFAULT '',
	`awardedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_store_stars_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_store_stars_uq` UNIQUE(`storeId`,`star`)
);
--> statement-breakpoint
ALTER TABLE `cz_store_stars` ADD CONSTRAINT `cz_store_stars_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_store_stars` ADD CONSTRAINT `cz_store_stars_awardedBy_users_id_fk` FOREIGN KEY (`awardedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_store_stars_store_ix` ON `cz_store_stars` (`storeId`);