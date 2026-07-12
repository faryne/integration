export interface StorytellerProject {
  id: number;
  public_id: string;
  user_id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  rating: "general" | "guidance" | "restricted";
  tags: string[];
  share_token: string;
  rating_count: number;
  average_rating: number;
  favorite_count: number;
  favorite_hidden?: boolean;
  created_at: string;
  updated_at: string;
  stories?: StorytellerStory[];
  author?: StorytellerUserProfile;
}

export interface StorytellerAgent {
  id: number;
  user_id: number;
  name: string;
  provider: string;
  model_name: string;
  agent_model_id: number | null;
  provider_apikey_id: number | null;
  default_prompt: string;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface StorytellerProviderAPIKey {
  id: number;
  provider: string;
  label: string;
  endpoint: string;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface StorytellerProviderAPIKeyRequest {
  provider: string;
  label: string;
  endpoint?: string;
  api_key: string;
}

export interface StorytellerProviderAPIKeyUpdateRequest {
  label: string;
  endpoint?: string;
  api_key?: string;
}

export interface StorytellerAgentModelOption {
  id: number;
  name: string;
  label: string;
  description: string;
  price: string;
}

export interface StorytellerAgentProviderModels {
  provider: string;
  label: string;
  models: StorytellerAgentModelOption[];
  allow_custom_model: boolean;
}

export interface StorytellerAgentPromptVersion {
  id: number;
  agent_id: number;
  name: string;
  provider: string;
  model_name: string;
  default_prompt: string;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStory {
  id: number;
  public_id: string;
  project_id: number;
  title: string;
  summary: string;
  status: "draft" | "completed";
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

export interface StorytellerStoryBookmark {
  id: number;
  user_id: number;
  story_id: number;
  story_version_id: number;
  line_index: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStoryBookmarkWithStory {
  id: number;
  story_id: number;
  story_public_id: string;
  story_title: string;
  story_version_id: number;
  latest_story_version_id: number;
  line_index: number;
  line_preview: string;
  created_at: string;
}

export interface StorytellerLore {
  id: number;
  public_id: string;
  project_id: number;
  title: string;
  latest_content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerLoreVersion {
  id: number;
  lore_id: number;
  title: string;
  content: string;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerProjectRanking {
  ranking?: number | null;
}

export type StorytellerSNSType =
  | "x"
  | "facebook"
  | "instagram"
  | "threads"
  | "website"
  | "plurk"
  | "bahamut"
  | "discord"
  | "youtube";

export interface StorytellerUserProfile {
  user_id: number;
  pen_name: string;
  bio?: string;
  use_default_avatar: boolean;
  avatar_url?: string;
  sns_links?: Record<string, string>;
  hide_favorite_projects: boolean;
  hide_favorite_authors: boolean;
  auto_save_enabled: boolean;
  auto_save_interval_minutes: number;
  created_at: string;
}

export interface StorytellerFavoriteAuthor extends StorytellerUserProfile {
  project_count: number;
  story_count: number;
  word_count: number;
  rating_count: number;
  average_rating: number;
  follower_count: number;
  hidden?: boolean;
}

export interface StorytellerProjectRequest {
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  rating: "general" | "guidance" | "restricted";
  tags: string[];
}

export interface StorytellerAgentRequest {
  name: string;
  provider: string;
  model_name: string;
  provider_apikey_id?: number | null;
  default_prompt: string;
}

export type StorytellerAgentRunMode =
  | "rewrite_selection"
  | "expand_selection"
  | "translate_selection"
  | "continue_chapter"
  | "custom_selection"
  | "custom_chapter";

export interface StorytellerAgentRunRequest {
  mode: StorytellerAgentRunMode;
  instruction: string;
  full_content: string;
  selected_content: string;
  selection_start?: number;
  selection_end?: number;
  provider_apikey_id?: number;
}

export interface StorytellerAgentRunUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

export interface StorytellerAgentRunResponse {
  agent_id: number;
  provider: string;
  model_name: string;
  mode: StorytellerAgentRunMode;
  result: string;
  usage?: StorytellerAgentRunUsage;
  finish_reason?: string;
}

export interface StorytellerStoryChatMessage {
  id: number;
  chat_id: number;
  role: "system" | "user" | "assistant";
  content: string;
  metadata?: string;
  agent_id: number;
  agent_name: string;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStoryChatMessagePage {
  items: StorytellerStoryChatMessage[];
  total: number;
  page: number;
  per_page: number;
}

export interface StorytellerAgentUsageSummaryRow {
  provider_apikey_id: number;
  provider: string;
  provider_apikey_label: string;
  agent_id: number;
  agent_name: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  run_count: number;
}

export interface StorytellerAgentUsageLogRow {
  id: number;
  created_at: string;
  model_name: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  story_title?: string;
  lore_title?: string;
}

export interface StorytellerAgentUsageLogPage {
  items: StorytellerAgentUsageLogRow[];
  total: number;
  page: number;
  per_page: number;
}

export interface StorytellerStoryRequest {
  title: string;
  summary: string;
  status: "draft" | "completed";
  sort: number;
  content: string;
}

export interface StorytellerLoreRequest {
  title: string;
  content: string;
}

export interface StorytellerUserProfileRequest {
  pen_name: string;
  bio: string;
  use_default_avatar: boolean;
  avatar_url: string;
  sns_links: Record<string, string>;
  hide_favorite_projects: boolean;
  hide_favorite_authors: boolean;
  auto_save_enabled: boolean;
  auto_save_interval_minutes: number;
}
