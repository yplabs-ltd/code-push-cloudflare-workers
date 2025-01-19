import { relations } from "drizzle-orm";
import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// Accounts table
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  githubId: text("github_id"),
  createdTime: integer("created_time").notNull(),
});

// Account relations
export const accountRelations = relations(account, ({ many }) => ({
  apps: many(app),
  accessKeys: many(accessKey),
}));

// Apps table
export const app = sqliteTable("app", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdTime: integer("created_time").notNull(),
});

// App relations
export const appRelations = relations(app, ({ many }) => ({
  collaborators: many(collaborator),
  deployments: many(deployment),
}));

// Collaborators table (join table for apps-accounts)
export const collaborator = sqliteTable(
  "collaborator",
  {
    appId: text("app_id")
      .notNull()
      .references(() => app.id),
    accountId: text("account_id")
      .notNull()
      .references(() => account.id),
    permission: text("permission", {
      enum: ["Owner", "Collaborator"],
    }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.appId, t.accountId] }),
  }),
);

// Collaborator relations
export const collaboratorRelations = relations(collaborator, ({ one }) => ({
  app: one(app, {
    fields: [collaborator.appId],
    references: [app.id],
  }),
  account: one(account, {
    fields: [collaborator.accountId],
    references: [account.id],
  }),
}));

// Deployments table
export const deployment = sqliteTable("deployment", {
  id: text("id").primaryKey(),
  appId: text("app_id")
    .notNull()
    .references(() => app.id),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  createdTime: integer("created_time").notNull(),
});

// Deployment relations
export const deploymentRelations = relations(deployment, ({ one, many }) => ({
  app: one(app, {
    fields: [deployment.appId],
    references: [app.id],
  }),
  packages: many(packages),
}));

// Packages table
export const packages = sqliteTable("package", {
  id: text("id").primaryKey(),
  deploymentId: text("deployment_id")
    .notNull()
    .references(() => deployment.id),
  label: text("label").notNull(),
  appVersion: text("app_version").notNull(),
  description: text("description"),
  isDisabled: integer("is_disabled", { mode: "boolean" }).notNull(),
  isMandatory: integer("is_mandatory", { mode: "boolean" }).notNull(),
  rollout: integer("rollout"),
  size: integer("size").notNull(),
  blobPath: text("blob_path").notNull(),
  manifestBlobPath: text("manifest_blob_path"),
  packageHash: text("package_hash").notNull(),
  releaseMethod: text("release_method", {
    enum: ["Upload", "Promote", "Rollback"],
  }),
  originalLabel: text("original_label"),
  originalDeployment: text("original_deployment"),
  releasedBy: text("released_by"),
  uploadTime: integer("upload_time").notNull(),
});

// Package relations
export const packageRelations = relations(packages, ({ one, many }) => ({
  deployment: one(deployment, {
    fields: [packages.deploymentId],
    references: [deployment.id],
  }),
  diffs: many(packageDiff),
}));

// Package diffs table
export const packageDiff = sqliteTable(
  "package_diff",
  {
    id: text("id").primaryKey(),
    packageId: text("package_id")
      .notNull()
      .references(() => packages.id),
    sourcePackageHash: text("source_package_hash").notNull(),
    size: integer("size").notNull(),
    blobPath: text("blob_path").notNull(),
  },
  (t) => [unique().on(t.packageId, t.sourcePackageHash)],
);

// Package diff relations
export const packageDiffRelations = relations(packageDiff, ({ one }) => ({
  package: one(packages, {
    fields: [packageDiff.packageId],
    references: [packages.id],
  }),
}));

// Access keys table
export const accessKey = sqliteTable("access_key", {
  id: text("id").primaryKey(),
  accountId: text("account_id")
    .notNull()
    .references(() => account.id),
  name: text("name").notNull().unique(),
  friendlyName: text("friendly_name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  createdTime: integer("created_time").notNull(),
  expires: integer("expires").notNull(),
  isSession: integer("is_session", { mode: "boolean" }),
});

// Access key relations
export const accessKeyRelations = relations(accessKey, ({ one }) => ({
  account: one(account, {
    fields: [accessKey.accountId],
    references: [account.id],
  }),
}));

export const metrics = sqliteTable(
  "metric",
  {
    deploymentId: text("deployment_id").notNull(),
    label: text("label").notNull(),
    type: text("type", {
      enum: [
        "active",
        "downloaded",
        "deployment_succeeded",
        "deployment_failed",
      ],
    }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.deploymentId, t.label, t.type] }),
    // unique().on(t.deploymentId, t.label, t.type),
  ],
);

// Client labels table (for active users)
export const clientLabels = sqliteTable(
  "client_label",
  {
    deploymentId: text("deployment_id").notNull(),
    clientId: text("client_id").notNull(),
    label: text("label").notNull(),
  },
  (t) => [primaryKey({ columns: [t.clientId, t.deploymentId] })],
  // (t) => ({
  //   pk: primaryKey({ columns: [t.clientId, t.deploymentId] }),
  // }),
);
