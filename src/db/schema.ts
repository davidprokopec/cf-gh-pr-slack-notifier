import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const prMessages = sqliteTable("pr_messages", {
  prKey: text("pr_key").primaryKey(),
  slackTs: text("slack_ts").notNull(),
  slackChannel: text("slack_channel").notNull(),
  status: text("status").notNull(),
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
});
