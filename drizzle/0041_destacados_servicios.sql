CREATE TABLE `cz_service_pub_services` (
	`serviceId` int NOT NULL,
	`userId` int NOT NULL,
	`activatedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_service_pub_services_serviceId` PRIMARY KEY(`serviceId`)
);
--> statement-breakpoint
ALTER TABLE `cz_service_pub_services` ADD CONSTRAINT `cz_service_pub_services_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_service_pub_services` ADD CONSTRAINT `cz_service_pub_services_activatedBy_users_id_fk` FOREIGN KEY (`activatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;