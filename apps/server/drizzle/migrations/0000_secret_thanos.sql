CREATE TABLE `access_key` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`friendly_name` text NOT NULL,
	`description` text,
	`created_by` text NOT NULL,
	`created_time` integer NOT NULL,
	`expires` integer NOT NULL,
	`is_session` integer,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_key_name_unique` ON `access_key` (`name`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`github_id` text,
	`created_time` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_email_unique` ON `account` (`email`);--> statement-breakpoint
CREATE TABLE `app` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_time` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `collaborator` (
	`app_id` text NOT NULL,
	`account_id` text NOT NULL,
	`permission` text NOT NULL,
	PRIMARY KEY(`app_id`, `account_id`),
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `deployment` (
	`id` text PRIMARY KEY NOT NULL,
	`app_id` text NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`created_time` integer NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `app`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deployment_key_unique` ON `deployment` (`key`);--> statement-breakpoint
CREATE TABLE `package_diff` (
	`id` text PRIMARY KEY NOT NULL,
	`package_id` text NOT NULL,
	`source_package_hash` text NOT NULL,
	`size` integer NOT NULL,
	`blob_path` text NOT NULL,
	FOREIGN KEY (`package_id`) REFERENCES `package`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `package_diff_package_id_source_package_hash_unique` ON `package_diff` (`package_id`,`source_package_hash`);--> statement-breakpoint
CREATE TABLE `package` (
	`id` text PRIMARY KEY NOT NULL,
	`deployment_id` text NOT NULL,
	`label` text NOT NULL,
	`app_version` text NOT NULL,
	`description` text,
	`is_disabled` integer NOT NULL,
	`is_mandatory` integer NOT NULL,
	`rollout` integer,
	`size` integer NOT NULL,
	`blob_path` text NOT NULL,
	`manifest_blob_path` text,
	`package_hash` text NOT NULL,
	`release_method` text,
	`original_label` text,
	`original_deployment` text,
	`released_by` text,
	`upload_time` integer NOT NULL,
	FOREIGN KEY (`deployment_id`) REFERENCES `deployment`(`id`) ON UPDATE no action ON DELETE no action
);
