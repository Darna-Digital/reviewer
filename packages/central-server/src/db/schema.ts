/**
 * The Postgres schema, in two halves.
 *
 * The first half is better-auth's: users, sessions, accounts, verification
 * tokens and the organization plugin's organizations, members and invitations.
 * Their column names and types are dictated by the library, so they are spelled
 * out here rather than generated at build time — `pnpm db:generate` diffs this
 * file, and `better-auth generate` can be run to check it still matches.
 *
 * The second half is the workspace domain. Every one of its rows carries the
 * organization it belongs to, and every foreign key into another tenant-owned
 * table cascades, so removing an organization removes its work with it.
 */
import { relations } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"
import type { TaskPriority, TaskStatus } from "@byconvo/core/tasks"
import type { AccentColor } from "@byconvo/core/projects"
import type { CommentSubject } from "@byconvo/core/workspace-comments"
import type { MemberRole } from "@byconvo/core/identity"

// --- better-auth -----------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** The organization plugin's per-session tenant selection. */
    activeOrganizationId: text("active_organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    /** The bcrypt hash for the email+password provider. */
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)]
)

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
)

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("member_org_user_unique").on(table.organizationId, table.userId),
    index("member_organization_id_idx").on(table.organizationId),
  ]
)

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<MemberRole>().notNull().default("member"),
    status: text("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("invitation_email_idx").on(table.email)]
)

// --- workspace domain ------------------------------------------------------

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /** Task-key prefix. Unique per organization, not globally. */
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    color: text("color").$type<AccentColor>().notNull().default("gray"),
    archived: boolean("archived").notNull().default(false),
    /**
     * The next task number this project will hand out. Bumped with a single
     * `UPDATE ... RETURNING`, so two concurrent creates cannot collide on a key.
     */
    nextTaskNumber: integer("next_task_number").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("projects_org_key_unique").on(table.organizationId, table.key),
    index("projects_organization_id_idx").on(table.organizationId),
  ]
)

export const labels = pgTable(
  "labels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").$type<AccentColor>().notNull().default("gray"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("labels_project_name_unique").on(table.projectId, table.name),
    index("labels_project_id_idx").on(table.projectId),
  ]
)

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<TaskStatus>().notNull().default("backlog"),
    priority: text("priority").$type<TaskPriority>().notNull().default("none"),
    /** Self-reference: deleting a task takes its sub-tasks with it. */
    parentId: uuid("parent_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    /** Fractional sort key within a status column — see `positionBetween`. */
    position: doublePrecision("position").notNull().default(1024),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    unique("tasks_project_number_unique").on(table.projectId, table.number),
    index("tasks_project_id_idx").on(table.projectId),
    index("tasks_project_status_idx").on(table.projectId, table.status),
    index("tasks_parent_id_idx").on(table.parentId),
  ]
)

export const taskLabels = pgTable(
  "task_labels",
  {
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.labelId] }),
    index("task_labels_label_id_idx").on(table.labelId),
  ]
)

export const docs = pgTable(
  "docs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("docs_project_id_idx").on(table.projectId)]
)

export const workspaceComments = pgTable(
  "workspace_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    /**
     * Tasks and docs share one thread table, so the subject is a (type, id)
     * pair rather than two nullable foreign keys. The rows are cleaned up by
     * the delete handlers on each subject, not by a database cascade.
     */
    subjectType: text("subject_type").$type<CommentSubject>().notNull(),
    subjectId: uuid("subject_id").notNull(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => workspaceComments.id,
      {
        onDelete: "cascade",
      }
    ),
    body: text("body").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    edited: boolean("edited").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("workspace_comments_subject_idx").on(
      table.subjectType,
      table.subjectId
    ),
    index("workspace_comments_parent_id_idx").on(table.parentId),
  ]
)

// --- relations (for drizzle's relational queries) --------------------------

export const projectsRelations = relations(projects, ({ many }) => ({
  tasks: many(tasks),
  labels: many(labels),
  docs: many(docs),
}))

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  labels: many(taskLabels),
}))

export const labelsRelations = relations(labels, ({ one, many }) => ({
  project: one(projects, {
    fields: [labels.projectId],
    references: [projects.id],
  }),
  tasks: many(taskLabels),
}))

export const taskLabelsRelations = relations(taskLabels, ({ one }) => ({
  task: one(tasks, { fields: [taskLabels.taskId], references: [tasks.id] }),
  label: one(labels, { fields: [taskLabels.labelId], references: [labels.id] }),
}))

export const docsRelations = relations(docs, ({ one }) => ({
  project: one(projects, {
    fields: [docs.projectId],
    references: [projects.id],
  }),
}))

export const workspaceCommentsRelations = relations(
  workspaceComments,
  ({ one }) => ({
    author: one(user, {
      fields: [workspaceComments.authorId],
      references: [user.id],
    }),
  })
)
