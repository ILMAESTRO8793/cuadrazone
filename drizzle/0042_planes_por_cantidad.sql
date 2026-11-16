CREATE TABLE `cz_section_plan_payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`section` varchar(20) NOT NULL,
	`planId` varchar(20) NOT NULL,
	`months` int NOT NULL,
	`amountCents` int NOT NULL,
	`method` enum('yappy','transferencia','efectivo','otro') NOT NULL,
	`reference` varchar(120),
	`paidOn` varchar(10) NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_section_plan_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_section_plan_payments_ref_idx` UNIQUE(`method`,`reference`)
);
--> statement-breakpoint
CREATE TABLE `cz_section_plans` (
	`userId` int NOT NULL,
	`section` varchar(20) NOT NULL,
	`planId` varchar(20) NOT NULL,
	`endsAt` timestamp NOT NULL,
	`trialUsedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_section_plans_userId_section_pk` PRIMARY KEY(`userId`,`section`)
);
--> statement-breakpoint
ALTER TABLE `cz_plan_selections` MODIFY COLUMN `planId` enum('normal','mayor_visibilidad','mediana','grande','rest_basico','rest_medio','rest_grande') NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_section_plan_payments` ADD CONSTRAINT `cz_section_plan_payments_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_section_plan_payments` ADD CONSTRAINT `cz_section_plan_payments_recordedBy_users_id_fk` FOREIGN KEY (`recordedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_section_plans` ADD CONSTRAINT `cz_section_plans_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_section_plan_payments_user_idx` ON `cz_section_plan_payments` (`userId`);