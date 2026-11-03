CREATE TABLE `cz_job_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`applicantUserId` int NOT NULL,
	`resume` json NOT NULL,
	`message` text NOT NULL,
	`status` enum('enviada','vista','entrevista','descartada') NOT NULL DEFAULT 'enviada',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_job_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_job_applications_uq` UNIQUE(`jobId`,`applicantUserId`)
);
--> statement-breakpoint
CREATE TABLE `cz_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(160) NOT NULL,
	`status` enum('draft','published','paused','closed') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 0,
	`title` varchar(120) NOT NULL,
	`company` varchar(120) NOT NULL,
	`area` varchar(30) NOT NULL,
	`jobType` varchar(30) NOT NULL,
	`modality` varchar(20) NOT NULL,
	`province` varchar(60) NOT NULL,
	`district` varchar(80) NOT NULL,
	`salaryNegotiable` int NOT NULL DEFAULT 0,
	`salaryMinCents` int,
	`salaryMaxCents` int,
	`salaryPeriod` varchar(20) NOT NULL DEFAULT 'mes',
	`description` text NOT NULL,
	`requirements` text NOT NULL,
	`benefits` text NOT NULL,
	`closesOn` varchar(10) NOT NULL,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_jobs_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cz_resumes` (
	`userId` int NOT NULL,
	`fullName` varchar(120) NOT NULL,
	`headline` varchar(120) NOT NULL,
	`summary` text NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(254) NOT NULL DEFAULT '',
	`province` varchar(60) NOT NULL,
	`availability` varchar(20) NOT NULL DEFAULT 'inmediata',
	`experience` json,
	`education` json,
	`skills` json,
	`languages` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_resumes_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `cz_job_applications` ADD CONSTRAINT `cz_job_applications_jobId_cz_jobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `cz_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_job_applications` ADD CONSTRAINT `cz_job_applications_applicantUserId_users_id_fk` FOREIGN KEY (`applicantUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_jobs` ADD CONSTRAINT `cz_jobs_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_resumes` ADD CONSTRAINT `cz_resumes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_job_applications_applicant_idx` ON `cz_job_applications` (`applicantUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_jobs_search_idx` ON `cz_jobs` (`status`,`area`,`province`);--> statement-breakpoint
CREATE INDEX `cz_jobs_owner_idx` ON `cz_jobs` (`userId`,`updatedAt`);