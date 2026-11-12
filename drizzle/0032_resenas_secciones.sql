CREATE TABLE `cz_listing_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` varchar(12) NOT NULL,
	`listingId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_listing_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_listing_contact_uq` UNIQUE(`kind`,`listingId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_listing_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`kind` varchar(12) NOT NULL,
	`listingId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`reviewerUserId` int NOT NULL,
	`rating` int NOT NULL,
	`body` text NOT NULL,
	`hiddenAt` timestamp,
	`hiddenReason` varchar(300),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_listing_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_listing_review_uq` UNIQUE(`kind`,`listingId`,`reviewerUserId`)
);
--> statement-breakpoint
ALTER TABLE `cz_listing_contacts` ADD CONSTRAINT `cz_listing_contacts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_listing_reviews` ADD CONSTRAINT `cz_listing_reviews_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_listing_reviews` ADD CONSTRAINT `cz_listing_reviews_reviewerUserId_users_id_fk` FOREIGN KEY (`reviewerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_listing_review_listing_ix` ON `cz_listing_reviews` (`kind`,`listingId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_listing_review_owner_ix` ON `cz_listing_reviews` (`ownerUserId`);