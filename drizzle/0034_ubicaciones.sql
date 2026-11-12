CREATE TABLE `cz_order_places` (
	`orderId` int NOT NULL,
	`latE6` int NOT NULL,
	`lngE6` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_order_places_orderId` PRIMARY KEY(`orderId`)
);
--> statement-breakpoint
CREATE TABLE `cz_places` (
	`kind` enum('tienda','inmueble','auto','empleo') NOT NULL,
	`refId` int NOT NULL,
	`latE6` int NOT NULL,
	`lngE6` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_places_kind_refId_pk` PRIMARY KEY(`kind`,`refId`)
);
--> statement-breakpoint
ALTER TABLE `cz_order_places` ADD CONSTRAINT `cz_order_places_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE cascade ON UPDATE no action;