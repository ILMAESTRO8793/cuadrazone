CREATE TABLE `cz_plan_selections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` enum('normal','mayor_visibilidad') NOT NULL,
	`catalogVersion` varchar(64) NOT NULL,
	`revision` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_plan_selections_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_plan_selections_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `cz_plan_selections` ADD CONSTRAINT `cz_plan_selections_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;