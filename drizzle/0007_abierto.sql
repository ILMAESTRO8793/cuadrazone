ALTER TABLE `cz_membership_applications` MODIFY COLUMN `denominationId` int;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` MODIFY COLUMN `churchName` varchar(160) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `cz_membership_applications` MODIFY COLUMN `pastorName` varchar(100) NOT NULL DEFAULT '';