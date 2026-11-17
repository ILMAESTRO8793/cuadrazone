ALTER TABLE `cz_jobs` ADD `bonusCents` int;--> statement-breakpoint
ALTER TABLE `cz_jobs` ADD `bonusDetail` varchar(200) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_resumes` ADD `photoUrl` varchar(512) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `cz_resumes` ADD `extras` json;--> statement-breakpoint
-- Las vacantes publicadas sin sueldo base pasan a borrador hasta que lo pongan.
UPDATE `cz_jobs` SET `status` = 'draft', `revision` = `revision` + 1 WHERE `status` IN ('published', 'paused') AND (`salaryNegotiable` = 1 OR `salaryMinCents` IS NULL OR `salaryMinCents` <= 0);