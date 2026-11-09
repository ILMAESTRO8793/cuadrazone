CREATE TABLE `cz_appointment_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`blockStart` timestamp NOT NULL,
	`appointmentId` int NOT NULL,
	CONSTRAINT `cz_appointment_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_appointment_blocks_uq` UNIQUE(`storeId`,`blockStart`)
);
--> statement-breakpoint
CREATE TABLE `cz_appointments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`storeId` int NOT NULL,
	`providerUserId` int NOT NULL,
	`clientUserId` int NOT NULL,
	`serviceTitle` varchar(120) NOT NULL,
	`priceLabel` varchar(60) NOT NULL DEFAULT '',
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`status` enum('confirmed','cancelled','completed','no_show') NOT NULL DEFAULT 'confirmed',
	`clientName` varchar(120) NOT NULL,
	`clientPhone` varchar(20) NOT NULL,
	`note` varchar(500) NOT NULL DEFAULT '',
	`cancelledBy` enum('client','provider'),
	`cancelReason` varchar(300),
	`cancelledAt` timestamp,
	`reminderSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_appointments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_service_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`weekday` int NOT NULL,
	`startMinute` int NOT NULL,
	`endMinute` int NOT NULL,
	CONSTRAINT `cz_service_availability_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cz_services` ADD `bookable` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_appointment_blocks` ADD CONSTRAINT `cz_appointment_blocks_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_appointment_blocks` ADD CONSTRAINT `cz_appointment_blocks_appointmentId_cz_appointments_id_fk` FOREIGN KEY (`appointmentId`) REFERENCES `cz_appointments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_appointments` ADD CONSTRAINT `cz_appointments_serviceId_cz_services_id_fk` FOREIGN KEY (`serviceId`) REFERENCES `cz_services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_appointments` ADD CONSTRAINT `cz_appointments_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_appointments` ADD CONSTRAINT `cz_appointments_providerUserId_users_id_fk` FOREIGN KEY (`providerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_appointments` ADD CONSTRAINT `cz_appointments_clientUserId_users_id_fk` FOREIGN KEY (`clientUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_service_availability` ADD CONSTRAINT `cz_service_availability_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_appointment_blocks_appt_ix` ON `cz_appointment_blocks` (`appointmentId`);--> statement-breakpoint
CREATE INDEX `cz_appointments_store_ix` ON `cz_appointments` (`storeId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `cz_appointments_client_ix` ON `cz_appointments` (`clientUserId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `cz_appointments_status_ix` ON `cz_appointments` (`status`,`startsAt`);--> statement-breakpoint
CREATE INDEX `cz_service_availability_store_ix` ON `cz_service_availability` (`storeId`,`weekday`);