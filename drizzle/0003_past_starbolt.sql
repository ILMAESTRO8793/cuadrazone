CREATE TABLE `cz_product_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`storageKey` varchar(320) NOT NULL,
	`url` varchar(500) NOT NULL,
	`mimeType` varchar(80) NOT NULL,
	`size` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_product_images_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_product_images_key_uq` UNIQUE(`storageKey`)
);
--> statement-breakpoint
CREATE TABLE `cz_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`slug` varchar(220) NOT NULL,
	`kind` enum('product','book') NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text NOT NULL,
	`category` varchar(120) NOT NULL,
	`priceCents` int NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`revision` int NOT NULL DEFAULT 1,
	`bookMetadata` json,
	`imageUrls` json NOT NULL,
	`deliveryModes` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_products_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `cz_stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`slug` varchar(180) NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text NOT NULL,
	`province` varchar(60) NOT NULL,
	`city` varchar(100) NOT NULL,
	`shippingFeeCents` int,
	`homeFeeCents` int,
	`deliveryProvinces` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_stores_slug_uq` UNIQUE(`slug`),
	CONSTRAINT `cz_stores_user_uq` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_variants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`sku` varchar(80) NOT NULL,
	`size` varchar(80),
	`color` varchar(80),
	`stock` int NOT NULL DEFAULT 0,
	`priceCents` int NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `cz_variants_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_variants_product_sku_uq` UNIQUE(`productId`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `cz_cart_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cartId` int NOT NULL,
	`variantId` int NOT NULL,
	`quantity` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_cart_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_cart_item_uq` UNIQUE(`cartId`,`variantId`)
);
--> statement-breakpoint
CREATE TABLE `cz_carts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_carts_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_cart_user_uq` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `cz_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buyerId` int NOT NULL,
	`sellerId` int NOT NULL,
	`orderId` int,
	`questionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_convo_order_uq` UNIQUE(`buyerId`,`sellerId`,`orderId`),
	CONSTRAINT `cz_convo_question_uq` UNIQUE(`buyerId`,`sellerId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `cz_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`productId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_favorite_uq` UNIQUE(`userId`,`productId`)
);
--> statement-breakpoint
CREATE TABLE `cz_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`senderId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`kind` varchar(80) NOT NULL,
	`body` varchar(500) NOT NULL,
	`payload` json,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cz_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`variantId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`size` varchar(80),
	`color` varchar(80),
	CONSTRAINT `cz_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` varchar(40) NOT NULL,
	`userId` int NOT NULL,
	`storeId` int NOT NULL,
	`checkoutKey` varchar(36) NOT NULL,
	`status` enum('pending','confirmed','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
	`paymentMethod` enum('yappy','transfer','cod') NOT NULL,
	`paymentStatus` enum('awaiting_payment','pending') NOT NULL DEFAULT 'awaiting_payment',
	`subtotalCents` int NOT NULL,
	`deliveryFeeCents` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`deliveryMode` enum('shipping','pickup','home') NOT NULL,
	`recipientName` varchar(160) NOT NULL,
	`phone` varchar(30) NOT NULL,
	`province` varchar(80) NOT NULL,
	`city` varchar(120) NOT NULL,
	`address` varchar(500) NOT NULL,
	`stockRestored` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_orders_number_unique` UNIQUE(`number`),
	CONSTRAINT `cz_order_checkout_uq` UNIQUE(`userId`,`checkoutKey`,`storeId`)
);
--> statement-breakpoint
CREATE TABLE `cz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`askerId` int NOT NULL,
	`body` text NOT NULL,
	`answerBody` text,
	`answererId` int,
	`answeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_review_user_product_uq` UNIQUE(`userId`,`productId`)
);
--> statement-breakpoint
ALTER TABLE `cz_product_images` ADD CONSTRAINT `cz_product_images_product_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_product_images` ADD CONSTRAINT `cz_product_images_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_products` ADD CONSTRAINT `cz_products_store_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_products` ADD CONSTRAINT `cz_products_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_stores` ADD CONSTRAINT `cz_stores_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_stores` ADD CONSTRAINT `cz_stores_app_fk` FOREIGN KEY (`userId`) REFERENCES `cz_membership_applications`(`userId`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_variants` ADD CONSTRAINT `cz_variants_product_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_cart_items` ADD CONSTRAINT `cz_cart_items_cartId_cz_carts_id_fk` FOREIGN KEY (`cartId`) REFERENCES `cz_carts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_cart_items` ADD CONSTRAINT `cz_cart_items_variantId_cz_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `cz_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_carts` ADD CONSTRAINT `cz_carts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_conversations` ADD CONSTRAINT `cz_conversations_buyerId_users_id_fk` FOREIGN KEY (`buyerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_conversations` ADD CONSTRAINT `cz_conversations_sellerId_users_id_fk` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_conversations` ADD CONSTRAINT `cz_conversations_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_conversations` ADD CONSTRAINT `cz_conversations_questionId_cz_questions_id_fk` FOREIGN KEY (`questionId`) REFERENCES `cz_questions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_favorites` ADD CONSTRAINT `cz_favorites_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_favorites` ADD CONSTRAINT `cz_favorites_productId_cz_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_messages` ADD CONSTRAINT `cz_messages_conversationId_cz_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `cz_conversations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_messages` ADD CONSTRAINT `cz_messages_senderId_users_id_fk` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_notifications` ADD CONSTRAINT `cz_notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_order_items` ADD CONSTRAINT `cz_order_items_orderId_cz_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `cz_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_order_items` ADD CONSTRAINT `cz_order_items_productId_cz_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_order_items` ADD CONSTRAINT `cz_order_items_variantId_cz_variants_id_fk` FOREIGN KEY (`variantId`) REFERENCES `cz_variants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD CONSTRAINT `cz_orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_orders` ADD CONSTRAINT `cz_orders_storeId_cz_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `cz_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_questions` ADD CONSTRAINT `cz_questions_productId_cz_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_questions` ADD CONSTRAINT `cz_questions_askerId_users_id_fk` FOREIGN KEY (`askerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_questions` ADD CONSTRAINT `cz_questions_answererId_users_id_fk` FOREIGN KEY (`answererId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_reviews` ADD CONSTRAINT `cz_reviews_productId_cz_products_id_fk` FOREIGN KEY (`productId`) REFERENCES `cz_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cz_reviews` ADD CONSTRAINT `cz_reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `cz_product_images_product_ix` ON `cz_product_images` (`productId`);--> statement-breakpoint
CREATE INDEX `cz_products_store_ix` ON `cz_products` (`storeId`);--> statement-breakpoint
CREATE INDEX `cz_products_owner_ix` ON `cz_products` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `cz_products_status_ix` ON `cz_products` (`status`);--> statement-breakpoint
CREATE INDEX `cz_products_category_ix` ON `cz_products` (`category`);--> statement-breakpoint
CREATE INDEX `cz_stores_province_ix` ON `cz_stores` (`province`);--> statement-breakpoint
CREATE INDEX `cz_variants_product_ix` ON `cz_variants` (`productId`);--> statement-breakpoint
CREATE INDEX `cz_cart_item_cart_ix` ON `cz_cart_items` (`cartId`);--> statement-breakpoint
CREATE INDEX `cz_convo_buyer_ix` ON `cz_conversations` (`buyerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `cz_convo_seller_ix` ON `cz_conversations` (`sellerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `cz_favorite_user_ix` ON `cz_favorites` (`userId`);--> statement-breakpoint
CREATE INDEX `cz_message_convo_ix` ON `cz_messages` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_notification_user_ix` ON `cz_notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_order_item_order_ix` ON `cz_order_items` (`orderId`);--> statement-breakpoint
CREATE INDEX `cz_order_user_ix` ON `cz_orders` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_order_store_ix` ON `cz_orders` (`storeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_order_key_ix` ON `cz_orders` (`userId`,`checkoutKey`);--> statement-breakpoint
CREATE INDEX `cz_question_product_ix` ON `cz_questions` (`productId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `cz_review_product_ix` ON `cz_reviews` (`productId`,`createdAt`);