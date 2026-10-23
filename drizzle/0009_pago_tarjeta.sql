ALTER TABLE `cz_orders` MODIFY COLUMN `paymentMethod` enum('yappy','transfer','cod','card_link','card_on_delivery') NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_stores` ADD `cardPaymentUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `cz_stores` ADD `cardOnDelivery` int DEFAULT 0 NOT NULL;