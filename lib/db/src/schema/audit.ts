import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";
import { postsTable } from "./posts";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").references(() => accountsTable.id, {
    onDelete: "set null",
  }),
  postId: integer("post_id").references(() => postsTable.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogsTable.$inferSelect;
