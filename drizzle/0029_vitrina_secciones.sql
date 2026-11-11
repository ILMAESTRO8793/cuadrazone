CREATE TABLE `cz_showcase_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`section` varchar(20) NOT NULL,
	`zone` varchar(12) NOT NULL,
	`title` varchar(80) NOT NULL,
	`subtitle` varchar(160) NOT NULL DEFAULT '',
	`mediaUrl` varchar(500),
	`mediaType` varchar(8) NOT NULL DEFAULT 'image',
	`linkUrl` varchar(300) NOT NULL DEFAULT '',
	`storeId` int,
	`active` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`startsOn` varchar(10) NOT NULL DEFAULT '',
	`endsOn` varchar(10) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_showcase_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cz_showcase_items` ADD CONSTRAINT `cz_showcase_items_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_showcase_section_ix` ON `cz_showcase_items` (`section`,`zone`,`active`);