import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: text("content").notNull(),
  role: text("role").notNull(), // 'user' or 'assistant'
  timestamp: timestamp("timestamp").defaultNow(),
  language: text("language"), // 'en' or 'hi'
});

export const collegeInfo = pgTable("college_info", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // 'hostel', 'department', 'contact', etc.
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"), // JSON string for additional data
});

export const collegeSettings = pgTable("college_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(), // JSONB stored as text
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertCollegeInfoSchema = createInsertSchema(collegeInfo).omit({
  id: true,
});

export const insertCollegeSettingsSchema = createInsertSchema(collegeSettings).omit({
  id: true,
  updated_at: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type CollegeInfo = typeof collegeInfo.$inferSelect;
export type InsertCollegeInfo = z.infer<typeof insertCollegeInfoSchema>;
export type CollegeSettings = typeof collegeSettings.$inferSelect;
export type InsertCollegeSettings = z.infer<typeof insertCollegeSettingsSchema>;
