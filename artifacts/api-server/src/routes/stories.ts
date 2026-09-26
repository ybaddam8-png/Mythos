import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  AdvanceStoryBody,
  AdvanceStoryParams,
  AdvanceStoryResponse,
  CreateStoryBody,
  CreateStoryResponse,
  DeleteStoryParams,
  GetStoryParams,
  GetStoryResponse,
  GetStoryStatsResponse,
  ListStoriesResponse,
  UpdateStoryBody,
  UpdateStoryParams,
  UpdateStoryResponse,
} from "@workspace/api-zod";
import { db, storiesTable, type StoryRecord } from "@workspace/db";
import { generateStoryTurn, StoryGenerationError } from "../lib/story-generator";

const router: IRouter = Router();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rateWindows = new Map<string, { startedAt: number; count: number }>();

function getGuestId(req: Request): string | null {
  const value = req.get("x-guest-id")?.trim();
  return value && uuidPattern.test(value) ? value : null;
}

function responseStory<T extends StoryRecord>(story: T) {
  return {
    ...story,
    createdAt: story.createdAt.toISOString(),
    updatedAt: story.updatedAt.toISOString(),
  };
}

function storyLimit(length: string): number {
  if (length === "Short") return 4;
  if (length === "Long") return 10;
  return 7;
}

function allowGeneration(req: Request, res: Response, guestId: string): boolean {
  const now = Date.now();
  const keys = [
    [`guest:${guestId}`, 40],
    [`ip:${req.ip || req.socket.remoteAddress || "unknown"}`, 240],
  ] as const;

  for (const [key, limit] of keys) {
    const current = rateWindows.get(key);
    if (current && now - current.startedAt < 60 * 60 * 1000 && current.count >= limit) {
      res.status(429).json({ error: "Story generation is temporarily limited. Please try again later." });
      return false;
    }
  }

  for (const [key] of keys) {
    const current = rateWindows.get(key);
    if (!current || now - current.startedAt >= 60 * 60 * 1000) {
      rateWindows.set(key, { startedAt: now, count: 1 });
    } else {
      current.count += 1;
    }
  }

  if (rateWindows.size > 5000) {
    for (const [key, window] of rateWindows) {
      if (now - window.startedAt >= 60 * 60 * 1000) rateWindows.delete(key);
    }
  }
  return true;
}

router.get("/stories", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  if (!guestId) {
    res.status(400).json({ error: "A valid guest session is required." });
    return;
  }

  const stories = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.guestId, guestId))
    .orderBy(desc(storiesTable.updatedAt));
  res.json(ListStoriesResponse.parse(stories.map(responseStory)));
});

router.post("/stories", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  if (!guestId) {
    res.status(400).json({ error: "A valid guest session is required." });
    return;
  }

  const parsed = CreateStoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!allowGeneration(req, res, guestId)) return;

  const now = new Date();
  const storySeed = {
    id: randomUUID(),
    guestId,
    ...parsed.data,
    scenes: [],
    state: {
      currentLocation: parsed.data.world,
      inventory: [],
      quests: parsed.data.character.goal ? [parsed.data.character.goal] : [],
      importantEvents: [],
      decisions: [],
      currentObjective: parsed.data.character.goal || "Discover what this world is hiding.",
      discoveredCharacters: [parsed.data.character.name],
    },
    status: "active",
    createdAt: now,
    updatedAt: now,
  } satisfies typeof storiesTable.$inferInsert;

  try {
    const { scene, state } = await generateStoryTurn(storySeed as StoryRecord, null, true, false);
    const [created] = await db
      .insert(storiesTable)
      .values({ ...storySeed, scenes: [scene], state, updatedAt: new Date() })
      .returning();
    if (!created) throw new Error("The opening scene could not be saved.");
    res.status(201).json(CreateStoryResponse.parse(responseStory(created)));
  } catch (error) {
    req.log.error({ err: error }, "Could not create story opening");
    res.status(error instanceof StoryGenerationError ? 503 : 502).json({
      error:
        error instanceof StoryGenerationError
          ? error.message
          : "The opening scene could not be generated. Check the AI connection and try again.",
    });
  }
});

router.get("/stories/stats", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  if (!guestId) {
    res.status(400).json({ error: "A valid guest session is required." });
    return;
  }

  const stories = await db
    .select()
    .from(storiesTable)
    .where(eq(storiesTable.guestId, guestId));
  const stats = {
    total: stories.length,
    active: stories.filter((story) => story.status === "active").length,
    completed: stories.filter((story) => story.status === "completed").length,
    choices: stories.reduce((total, story) => total + story.state.decisions.length, 0),
    chapters: stories.reduce(
      (total, story) => total + new Set(story.scenes.map((scene) => scene.chapter)).size,
      0,
    ),
  };
  res.json(GetStoryStatsResponse.parse(stats));
});

router.get("/stories/:id", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  const params = GetStoryParams.safeParse(req.params);
  if (!guestId || !params.success) {
    res.status(400).json({ error: "A valid guest session and story ID are required." });
    return;
  }

  const [story] = await db
    .select()
    .from(storiesTable)
    .where(and(eq(storiesTable.id, params.data.id), eq(storiesTable.guestId, guestId)));
  if (!story) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  res.json(GetStoryResponse.parse(responseStory(story)));
});

router.patch("/stories/:id", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  const params = UpdateStoryParams.safeParse(req.params);
  const body = UpdateStoryBody.safeParse(req.body);
  if (!guestId || !params.success || !body.success) {
    res.status(400).json({ error: "A valid guest session, story ID, and title are required." });
    return;
  }

  const [story] = await db
    .update(storiesTable)
    .set({ title: body.data.title, updatedAt: new Date() })
    .where(and(eq(storiesTable.id, params.data.id), eq(storiesTable.guestId, guestId)))
    .returning();
  if (!story) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  res.json(UpdateStoryResponse.parse(responseStory(story)));
});

router.delete("/stories/:id", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  const params = DeleteStoryParams.safeParse(req.params);
  if (!guestId || !params.success) {
    res.status(400).json({ error: "A valid guest session and story ID are required." });
    return;
  }

  const [deleted] = await db
    .delete(storiesTable)
    .where(and(eq(storiesTable.id, params.data.id), eq(storiesTable.guestId, guestId)))
    .returning({ id: storiesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  res.sendStatus(204);
});

router.post("/stories/:id/turn", async (req, res): Promise<void> => {
  const guestId = getGuestId(req);
  const params = AdvanceStoryParams.safeParse(req.params);
  const body = AdvanceStoryBody.safeParse(req.body);
  if (!guestId || !params.success || !body.success) {
    res.status(400).json({ error: "A valid guest session and story action are required." });
    return;
  }

  const [story] = await db
    .select()
    .from(storiesTable)
    .where(and(eq(storiesTable.id, params.data.id), eq(storiesTable.guestId, guestId)));
  if (!story) {
    res.status(404).json({ error: "Story not found." });
    return;
  }
  if (story.status === "completed") {
    res.status(409).json({ error: "This story has already reached its ending." });
    return;
  }
  if (!story.scenes.length || body.data.action === null) {
    res.status(400).json({ error: "Choose an action before continuing this story." });
    return;
  }
  if (!allowGeneration(req, res, guestId)) return;

  const ending = story.scenes.length + 1 >= storyLimit(story.length);
  try {
    const generated = await generateStoryTurn(
      story,
      body.data.action,
      false,
      ending,
    );
    const scenes = [...story.scenes, generated.scene];
    const [updated] = await db
      .update(storiesTable)
      .set({
        scenes,
        state: generated.state,
        status: generated.complete ? "completed" : "active",
        updatedAt: new Date(),
      })
      .where(and(eq(storiesTable.id, story.id), eq(storiesTable.guestId, guestId)))
      .returning();
    if (!updated) throw new Error("The generated scene could not be saved.");
    res.json(AdvanceStoryResponse.parse(responseStory(updated)));
  } catch (error) {
    req.log.error({ err: error, storyId: story.id }, "Could not generate story continuation");
    res.status(error instanceof StoryGenerationError ? 503 : 502).json({
      error:
        error instanceof StoryGenerationError
          ? error.message
          : "The next scene could not be generated. Your story is safe; try again.",
    });
  }
});

export default router;