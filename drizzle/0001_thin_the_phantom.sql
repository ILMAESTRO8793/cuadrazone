CREATE TABLE `cz_membership_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessType` enum('individual','company') NOT NULL,
	`businessName` varchar(160) NOT NULL DEFAULT '',
	`identificationType` enum('cedula','residencia') NOT NULL,
	`identificationNumber` varchar(40) NOT NULL,
	`documentExpiry` varchar(10) NOT NULL DEFAULT '',
	`province` varchar(60) NOT NULL,
	`city` varchar(100) NOT NULL,
	`denominationId` int NOT NULL,
	`churchName` varchar(160) NOT NULL,
	`pastorName` varchar(100) NOT NULL,
	`residenceConfirmed` int NOT NULL DEFAULT 0,
	`faithAccepted` int NOT NULL DEFAULT 0,
	`conductAccepted` int NOT NULL DEFAULT 0,
	`privacyAccepted` int NOT NULL DEFAULT 0,
	`consentVersion` varchar(64) NOT NULL,
	`status` enum('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 1,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(20) NOT NULL,
	`submittedAt` timestamp,
	`reviewedAt` timestamp,
	`reviewReason` text,
	`subscriptionStatus` enum('not_started','active','past_due','cancelled') NOT NULL DEFAULT 'not_started',
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_membership_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_membership_applications_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_denominations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_denominations_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_denominations_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `cz_membership_audit` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int,
	`userId` int NOT NULL,
	`actorUserId` int,
	`action` varchar(80) NOT NULL,
	`reason` text,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_membership_audit_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_membership_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`displayName` varchar(100) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`emailVerifiedAt` timestamp,
	`phoneVerifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_membership_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_membership_profiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_verification_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`applicationId` int NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('identity','pastoral') NOT NULL,
	`fileName` varchar(200) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`bytes` mediumblob NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_verification_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD CONSTRAINT `cz_membership_applications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD CONSTRAINT `cz_membership_applications_denominationId_cz_denominations_id_fk` FOREIGN KEY (`denominationId`) REFERENCES `cz_denominations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_membership_audit` ADD CONSTRAINT `cz_audit_app_fk` FOREIGN KEY (`applicationId`) REFERENCES `cz_membership_applications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_membership_audit` ADD CONSTRAINT `cz_membership_audit_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_membership_audit` ADD CONSTRAINT `cz_membership_audit_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_membership_profiles` ADD CONSTRAINT `cz_membership_profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_verification_documents` ADD CONSTRAINT `cz_documents_app_fk` FOREIGN KEY (`applicationId`) REFERENCES `cz_membership_applications`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_verification_documents` ADD CONSTRAINT `cz_verification_documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT IGNORE INTO `cz_denominations` (`name`, `active`) VALUES ('Iglesia Cuadrangular', 1), ('Iglesia de Dios', 1), ('Asambleas de Dios', 1);
