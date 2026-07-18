import {
  pgTable,
  serial,
  text,
  integer,
  real,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const platformEnum = pgEnum("platform", ["twitter", "reddit"]);
export const accountStatusEnum = pgEnum("account_status", [
  "active",
  "suspended",
  "paused",
]);

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  platform: platformEnum("platform").notNull(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  status: accountStatusEnum("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  proxyConfig: text("proxy_config"),
  voiceProfile: text("voice_profile"),
  oauthAccessToken: text("oauth_access_token"),
  oauthRefreshToken: text("oauth_refresh_token"),
  postsCount: integer("posts_count").notNull().default(0),
  followersCount: integer("followers_count").notNull().default(0),
  engagementRate: real("engagement_rate").notNull().default(0),
  lastPostAt: timestamp("last_post_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
