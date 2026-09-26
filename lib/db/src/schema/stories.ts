import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type StoryCharacter = {
  name: string;
  age: number;
  role: string;
  personality: string;
  background: string;
  strengths: string;
  weaknesses: string;
  goal: string;
  fear: string;
  ability: string;
};

export type StoryChoice = { id: string; text: string };

export type StoryScene = {
  id: string;
  chapter: number;
  chapterTitle: string;
  title: string;
  location: string;
  mood: string;
  narrative: string;
  playerAction: string | null;
  choices: StoryChoice[];
  createdAt: string;
};

export type StoryWorldState = {
  currentLocation: string;
  inventory: string[];
  quests: string[];
  importantEvents: string[];
  decisions: string[];
  currentObjective: string;
  discoveredCharacters: string[];
};

export const storiesTable = pgTable("stories", {
  id: text("id").primaryKey(),
  guestId: uuid("guest_id").notNull(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  world: text("world").notNull(),
  tone: text("tone").notNull(),
  length: text("length").notNull(),
  difficulty: text("difficulty").notNull(),
  style: text("style").notNull(),
  character: jsonb("character").$type<StoryCharacter>().notNull(),
  scenes: jsonb("scenes").$type<StoryScene[]>().notNull().default([]),
  state: jsonb("state").$type<StoryWorldState>().notNull(),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertStorySchema = createInsertSchema(storiesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertStory = typeof storiesTable.$inferInsert;
export type StoryRecord = typeof storiesTable.$inferSelect;