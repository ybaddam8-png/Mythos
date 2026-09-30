import type { z } from "zod";
import type {
  AdvanceStoryBody,
  AdvanceStoryParams,
  AdvanceStoryResponse,
  CreateStoryBody,
  CreateStoryResponse,
  DeleteStoryParams,
  GetStoryParams,
  GetStoryResponse,
  GetStoryStatsResponse,
  HealthCheckResponse,
  ListStoriesResponse,
  ListStoriesResponseItem,
  UpdateStoryBody,
  UpdateStoryParams,
  UpdateStoryResponse,
} from "./api";

export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;
export type ListStoriesResponseItem = z.infer<typeof ListStoriesResponseItem>;
export type ListStoriesResponse = z.infer<typeof ListStoriesResponse>;
export type CreateStoryBody = z.infer<typeof CreateStoryBody>;
export type CreateStoryResponse = z.infer<typeof CreateStoryResponse>;
export type GetStoryParams = z.infer<typeof GetStoryParams>;
export type GetStoryResponse = z.infer<typeof GetStoryResponse>;
export type UpdateStoryParams = z.infer<typeof UpdateStoryParams>;
export type UpdateStoryBody = z.infer<typeof UpdateStoryBody>;
export type UpdateStoryResponse = z.infer<typeof UpdateStoryResponse>;
export type DeleteStoryParams = z.infer<typeof DeleteStoryParams>;
export type AdvanceStoryParams = z.infer<typeof AdvanceStoryParams>;
export type AdvanceStoryBody = z.infer<typeof AdvanceStoryBody>;
export type AdvanceStoryResponse = z.infer<typeof AdvanceStoryResponse>;
export type GetStoryStatsResponse = z.infer<typeof GetStoryStatsResponse>;

export type Story = CreateStoryResponse;
export type Character = CreateStoryResponse["character"];
export type Scene = CreateStoryResponse["scenes"][number];
export type Choice = Scene["choices"][number];
export type WorldState = CreateStoryResponse["state"];
export type StoryInput = CreateStoryBody;
export type StoryUpdate = UpdateStoryBody;
export type StoryTurnInput = AdvanceStoryBody;
export type StoryStats = GetStoryStatsResponse;
