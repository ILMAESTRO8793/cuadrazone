CREATE TABLE `cz_dispatch_jobs` (
	`orderId` int NOT NULL,
	`dispatcherUserId` int NOT NULL,
	`takenAt` timestamp NOT NULL DEFAULT (now()),
	`deliveredAt` timestamp,
	`photoUrl` varchar(500),
	`earningCents` int NOT NULL DEFAULT 0,
	`paidAt` timestamp,
	`lastLatE6` int,
	`lastLngE6` int,
	`lastAt` timestamp,
	CONSTRAINT `cz_dispatch_jobs_orderId` PRIMARY KEY(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `cz_dispatchers` (
	`userId` int NOT NULL,
	`fullName` varchar(120) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`province` varchar(60) NOT NULL,
	`vehicle` enum('moto','carro','bicicleta','otro') NOT NULL,
	`plate` varchar(20) NOT NULL DEFAULT '',
	`status` enum('pending','approved','suspended') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_dispatchers_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `cz_dispatch_jobs` ADD CONSTRAINT `cz_dispatch_jobs_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_dispatchers` ADD CONSTRAINT `cz_dispatchers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_dispatch_jobs_dispatcher_ix` ON `cz_dispatch_jobs` (`dispatcherUserId`);