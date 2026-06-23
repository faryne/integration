export interface StorytellerProject {
  id: number;
  public_id: string;
  user_id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  share_token: string;
  rating_count: number;
  average_rating: number;
  created_at: string;
  updated_at: string;
  stories?: StorytellerStory[];
}

export interface StorytellerAgent {
  id: number;
  user_id: number;
  name: string;
  provider: string;
  model_name: string;
  default_prompt: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStory {
  id: number;
  public_id: string;
  project_id: number;
  title: string;
  summary: string;
  sort: number;
  latest_content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStoryVersion {
  id: number;
  story_id: number;
  title: string;
  summary: string;
  content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerProjectRequest {
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
}

export interface StorytellerAgentRequest {
  name: string;
  provider: string;
  model_name: string;
  api_key?: string;
  default_prompt: string;
}

export interface StorytellerStoryRequest {
  title: string;
  summary: string;
  sort: number;
  content: string;
}
