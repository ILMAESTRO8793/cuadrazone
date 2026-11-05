ALTER TABLE `cz_order_items` DROP FOREIGN KEY `cz_order_items_productId_cz_products_id_fk`;
--> statement-breakpoint
ALTER TABLE `cz_order_items` DROP FOREIGN KEY `cz_order_items_variantId_cz_variants_id_fk`;
--> statement-breakpoint
ALTER TABLE `cz_orders` DROP FOREIGN KEY `cz_orders_storeId_cz_stores_id_fk`;
--> statement-breakpoint
ALTER TABLE `cz_order_items` MODIFY COLUMN `productId` int;--> statement-breakpoint
ALTER TABLE `cz_order_items` MODIFY COLUMN `variantId` int;--> statement-breakpoint
ALTER TABLE `cz_orders` MODIFY COLUMN `storeId` int;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD `storeName` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_order_items` ADD CONSTRAINT `cz_order_items_productId_cz_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_order_items` ADD CONSTRAINT `cz_order_items_variantId_cz_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `cz_variants`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD CONSTRAINT `cz_orders_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE set null ON UPDATE no action;