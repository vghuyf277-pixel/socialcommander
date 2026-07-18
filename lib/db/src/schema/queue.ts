import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobTypeEnum = pgEnum("job_type", [
  "post_publish",
  "post_retry",
  "analytics_sync",
  "engagement_check",
]);

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const queueJobsTable = pgTable("queue_jobs", {
  id: serial("id").primaryKey(),
  type: jobTypeEnum("type").notNull(),
  status: jobStatusEnum("status").notNull().default("pending"),
  payload: jsonb("payload").notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertQueueJobSchema = createInsertSchema(queueJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertQueueJob = z.infer<typeof insertQueueJobSchema>;
export type QueueJob = typeof queueJobsTable.$inferSelect;
