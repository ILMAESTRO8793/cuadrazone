CREATE TABLE `cz_restaurant_orders` (
	`orderId` int NOT NULL,
	`prepMinutes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_restaurant_orders_orderId` PRIMARY KEY(`orderId`)
);
--> statement-breakpoint
ALTER TABLE `cz_restaurant_orders` ADD CONSTRAINT `cz_restaurant_orders_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE cascade ON UPDATE no action;