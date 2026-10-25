CREATE TABLE `cz_auth_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purpose` enum('login','verify_contact') NOT NULL,
	`channel` enum('email','phone') NOT NULL,
	`destination` varchar(320) NOT NULL,
	`userId` int,
	`codeHash` varchar(64) NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp NOT NULL,
	`consumedAt` timestamp,
	`ip` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_auth_codes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
CREATE INDEX `cz_auth_codes_destination_idx` ON `cz_auth_codes` (`destination`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_auth_codes_ip_idx` ON `cz_auth_codes` (`ip`,`createdAt`);