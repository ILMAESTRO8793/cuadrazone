CREATE TABLE `cz_country_waitlist` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(254) NOT NULL,
	`country` varchar(2) NOT NULL,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_country_waitlist_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_country_waitlist_uq` UNIQUE(`email`,`country`)
);
--> statement-breakpoint
CREATE INDEX `cz_country_waitlist_ip_idx` ON `cz_country_waitlist` (`ip`,`createdAt`);