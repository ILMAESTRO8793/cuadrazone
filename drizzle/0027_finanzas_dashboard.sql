CREATE TABLE `cz_expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category` varchar(32) NOT NULL,
	`description` varchar(200) NOT NULL,
	`amountCents` int NOT NULL,
	`spentOn` varchar(10) NOT NULL,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_finance_settings` (
	`id` int NOT NULL,
	`settings` json NOT NULL,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_finance_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cz_expenses` ADD CONSTRAINT `cz_expenses_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_finance_settings` ADD CONSTRAINT `cz_finance_settings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_expenses_spent_ix` ON `cz_expenses` (`spentOn`);