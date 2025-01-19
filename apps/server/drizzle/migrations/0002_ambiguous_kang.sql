ALTER TABLE `access_key` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `app` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `deployment` ADD `deleted_at` integer;--> statement-breakpoint
ALTER TABLE `package` ADD `deleted_at` integer;