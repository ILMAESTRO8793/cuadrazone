CREATE TABLE `cz_dispatcher_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` enum('licencia','record') NOT NULL,
	`fileName` varchar(200) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`bytes` mediumblob NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_dispatcher_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_dispatcher_documents_uq` UNIQUE(`userId`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `cz_dispatcher_documents` ADD CONSTRAINT `cz_dispatcher_documents_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;