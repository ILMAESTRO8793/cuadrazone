ALTER TABLE `cz_verification_documents` MODIFY COLUMN `kind` enum('identity','pastoral','payout') NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `payoutDocumentId` int;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `legalGivenNames` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `legalSurnames` varchar(120) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `country` varchar(2) DEFAULT 'PA' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_membership_applications` ADD `autoChecks` json;