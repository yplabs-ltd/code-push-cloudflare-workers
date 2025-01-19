CREATE TABLE `client_label` (
	`deployment_id` text NOT NULL,
	`client_id` text NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`client_id`, `deployment_id`)
);
--> statement-breakpoint
CREATE TABLE `metric` (
	`deployment_id` text NOT NULL,
	`label` text NOT NULL,
	`type` text NOT NULL,
	`count` integer NOT NULL,
	PRIMARY KEY(`deployment_id`, `label`, `type`)
);
