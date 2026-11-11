CREATE TABLE `cz_banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(80) NOT NULL,
	`subtitle` varchar(160) NOT NULL DEFAULT '',
	`imageUrl` varchar(500),
	`linkUrl` varchar(300) NOT NULL DEFAULT '',
	`active` int NOT NULL DEFAULT 0,
	`sortOrder` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cz_catalog_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cz_catalog_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `cz_catalog_categories_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `cz_banners_active_ix` ON `cz_banners` (`active`,`sortOrder`);
--> statement-breakpoint
INSERT INTO `cz_catalog_categories` (`name`, `active`, `sortOrder`) VALUES
('Hogar y cocina', 1, 10),
('Ropa y calzado', 1, 20),
('Tecnología y accesorios', 1, 30),
('Alimentos y repostería', 1, 40),
('Belleza y cuidado personal', 1, 50),
('Artesanías', 1, 60),
('Papelería y útiles escolares', 1, 70),
('Instrumentos y música', 1, 80),
('Accesorios y joyería', 1, 90),
('Salud y bienestar', 1, 100),
('Bebés y niños', 1, 110),
('Juguetes', 1, 120),
('Deportes', 1, 130),
('Ferretería y herramientas', 1, 140),
('Autos y repuestos', 1, 150),
('Mascotas', 1, 160),
('Libros cristianos', 1, 170),
('Devocionales', 1, 180),
('Biblias', 1, 190),
('Regalos y recuerdos', 1, 200),
('Arte y decoración', 1, 210);
