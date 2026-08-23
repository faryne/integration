export interface StorytellerProject {
  id: number;
  public_id: string;
  user_id: number;
  name: string;
  slug: string;
  description: string;
  visibility: "public" | "unlisted" | "private";
  rating: "general" | "guidance" | "restricted";
  // 建立後不可變更，前端建立專案時鎖定選擇的類型。
  content_type: "text" | "image";
  tags: string[];
  share_token: string;
  rating_count: number;
  average_rating: number;
  favorite_count: number;
  favorite_hidden?: boolean;
  created_at: string;
  updated_at: string;
  stories?: StorytellerStory[];
  // 讓閱讀頁／工作台故事列表可以把 stories 依冊分組顯示，不用另外呼叫只給登入者用的 API。
  volumes?: StorytellerStory[];
  author?: StorytellerUserProfile;
  // 底下四個只有單一專案詳情（工作台側邊欄「全部設定」「全部資產」「未分類」
  // 用）才會有值，專案列表／閱讀頁不會帶。
  lore_count?: number;
  lore_uncategorized_count?: number;
  asset_count?: number;
  asset_uncategorized_count?: number;
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

export interface StorytellerPersonalAccessToken {
  id: number;
  label: string;
  token_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface StorytellerPersonalAccessTokenRequest {
  label: string;
  expires_in_days?: number;
}

// 明碼 token 只在建立當下回傳一次，之後只查得到 StorytellerPersonalAccessToken。
export interface StorytellerPersonalAccessTokenCreated extends StorytellerPersonalAccessToken {
  token: string;
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
  // 所屬冊（另一筆 is_volume=true 的故事）的 public_id 對應 id；NULL 代表未分冊或本身就是一冊。
  parent_id: number | null;
  // 是否為冊——只有標題、不使用內容欄位的容器故事。
  is_volume: boolean;
  // text=一般文字故事；image=圖像作品（「話」），latest_content 是 JSON（頁面陣列），
  // 不是 markdown，不要直接當文字渲染。建立後不可變更。
  content_type: "text" | "image";
  title: string;
  summary: string;
  status: "draft" | "completed";
  sort: number;
  latest_content: string;
  latest_version_id: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
  // 只有存檔（PUT）的回應才有意義：這次存檔帶的 base_version_id 已經不是最新版本，
  // 但內容照樣存成新版本，沒有被拒絕；GET 回來的資料不會有這個欄位。
  version_conflict?: boolean;
}

export interface StorytellerStoryVolumeRequest {
  title: string;
  // 跟 StorytellerStoryRequest.sort 一樣，每次存檔都要帶目前值，不是只有拖曳排序才送。
  sort: number;
  // 冊本身的公開／未公開狀態。關閉（draft）時，底下所有故事一律不對外顯示。
  status: "draft" | "completed";
  // 給讀者看的說明文字。
  summary: string;
  // 只有建立時會用到（決定底下要掛文字故事還是圖像頁），更新時後端會忽略此欄位。
  content_type?: "text" | "image";
}

// StorytellerStoryImagePage 是「話」（content_type=image 的故事）JSON 內容裡的單一頁面，
// 讀取時由後端簽好 image_url 才回傳，不是存在 DB 裡的原始形狀。
export interface StorytellerStoryImagePage {
  id: string;
  // 只有作者本人的管理頁（useStorytellerImageStoryPages）會有值，公開／分享閱讀頁
  // 不會回傳——編輯既有話時用來重組完整 JSON 存回去，不用重新上傳沒改過的頁面。
  key?: string;
  asset_public_id?: string;
  image_url: string;
  description: string;
  sort: number;
}

export interface StorytellerImagePageUploadOutput {
  key: string;
  upload_url: string;
}

export interface StorytellerAsset {
  id: number;
  public_id: string;
  project_id: number;
  collection_id?: string;
  asset_type: "image" | "audio" | "video";
  mime_type: string;
  file_ext: string;
  file_size: number;
  metadata: Record<string, unknown>;
  original_filename: string;
  title: string;
  alt_text: string;
  description: string;
  preview_url: string;
  reference_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerAssetCollection {
  id: number;
  public_id: string;
  project_id: number;
  name: string;
  description: string;
  sort: number;
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerAssetCollectionRequest {
  name: string;
  description: string;
  sort: number;
}

export interface StorytellerAssetPage {
  assets: StorytellerAsset[];
  total_count: number;
  page: number;
  page_size: number;
}

export interface StorytellerAssetUploadOutput {
  key: string;
  upload_url: string;
  content_type: string;
  original_filename: string;
}

export interface StorytellerAssetUpdateRequest {
  title: string;
  alt_text: string;
  description: string;
  metadata: Record<string, unknown>;
}

export interface StorytellerStoryVolumeEvent {
  id: number;
  story_id: number;
  story_public_id: string;
  story_title: string;
  from_volume_id: number | null;
  to_volume_id: number | null;
  created_at: string;
}

export interface StorytellerStoryVolumeActivity {
  events: StorytellerStoryVolumeEvent[];
  versions: StorytellerStoryVersion[];
}

export interface StorytellerStoryVersion {
  id: number;
  story_id: number;
  title: string;
  summary: string;
  content: string;
  source: string;
  // 這個版本是「回復到某個舊版本」產生的，記錄回復的來源版本；一般存檔不會有值。
  reverted_from_version_id: number | null;
  // 存檔當下 base_version_id 已經不是最新版本，記錄當時真正最新的那個版本。
  conflicted_with_version_id: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
}

// line_id 對文字故事是行號的字串形式（"0"、"12"...），對圖片故事（話）是頁面 id。
// story_version_id 只有文字書籤會有值——圖片頁面 id 不隨版本變動，不綁定特定版本。
export interface StorytellerStoryBookmark {
  id: number;
  user_id: number;
  story_id: number;
  story_version_id?: number | null;
  line_id: string;
  created_at: string;
  updated_at: string;
}

export interface StorytellerStoryBookmarkWithStory {
  id: number;
  story_id: number;
  story_public_id: string;
  story_title: string;
  content_type: "text" | "image";
  story_version_id?: number | null;
  latest_story_version_id?: number;
  line_id: string;
  line_preview?: string;
  page_sort?: number;
  thumbnail_url?: string;
  created_at: string;
}

export interface StorytellerLore {
  id: number;
  public_id: string;
  project_id: number;
  collection_id?: string;
  title: string;
  latest_content: string;
  latest_version_id: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
  version_conflict?: boolean;
}

export interface StorytellerLoreVersion {
  id: number;
  lore_id: number;
  title: string;
  content: string;
  source: string;
  reverted_from_version_id: number | null;
  conflicted_with_version_id: number | null;
  word_count: number;
  created_at: string;
  updated_at: string;
}

export interface StorytellerLoreCollection {
  id: number;
  public_id: string;
  project_id: number;
  name: string;
  description: string;
  sort: number;
  lore_count: number;
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
  // 只有故事閱讀頁的 project.author 會帶這個欄位（後端只在那個入口多查一次）
  follower_count?: number;
}

export interface StorytellerFavoriteAuthor extends StorytellerUserProfile {
  project_count: number;
  story_count: number;
  image_story_count: number;
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
  // 只有建立時採用，更新專案時後端一律忽略、維持建立當下的值。
  content_type: "text" | "image";
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
  model_name?: string;
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

// AAS（agentic AI storyteller）：多輪、會自己呼叫工具查資料的問答功能，跟上面
// 單輪無工具呼叫能力的 StorytellerAgentRunRequest／Response（改寫/擴寫/翻譯）
// 是刻意分開的兩組型別，對應後端兩條不同的路由。
export interface StorytellerAgenticQueryRequest {
  user_prompt: string;
  // 兩者都留空時沿用 Agent 的預設值；帶其中一個或兩個時，這次呼叫改用指定的
  // key／model（可以跟 Agent 記錄的 provider 不同）——這是切換 API Key 功能的
  // 請求介面。
  provider_apikey_id?: number;
  model_name?: string;
}

export interface StorytellerAgenticToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface StorytellerAgenticToolResult {
  content: string;
  error?: string;
}

export interface StorytellerAgenticStep {
  tool_calls: StorytellerAgenticToolCall[];
  results: StorytellerAgenticToolResult[];
}

// 這輪對話裡 agent 想呼叫、但被攔下來、還沒真的執行的寫入類工具呼叫。要套用時
// 把 tool_name／arguments 原樣送回 useApplyStorytellerAgentProposal。
export interface StorytellerAgenticProposal {
  tool_call_id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
}

export interface StorytellerAgenticQueryResponse {
  agent_id: number;
  provider: string;
  model_name: string;
  result: string;
  steps: StorytellerAgenticStep[];
  proposals: StorytellerAgenticProposal[];
  usage?: StorytellerAgentRunUsage;
  // 非空代表這輪對話撞到步數上限被強制中止，沒有真的拿到最終答案，但其餘欄位
  // 仍然是累積到中止那刻的真實資料，不是空殼——當成「部分結果＋警告」呈現。
  warning?: string;
}

export interface StorytellerApplyAgentProposalRequest {
  tool_name: string;
  arguments: Record<string, unknown>;
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
  save_trigger?: "auto" | "manual";
  // 帶入目前手上內容對應的版本 id；若這篇故事的最新版本已經不是這個 id，
  // 後端會拒絕這次存檔並回 409，代表內容被別的地方（例如 MCP 工具）動過。
  base_version_id?: number;
  // 所屬冊的 public_id；空字串或不帶代表移出冊／不分冊。只能指向一冊，後端會驗證。
  parent_id?: string;
  // 只有建立時會用到（text=一般文字故事，image=圖像作品），更新時後端會忽略此欄位。
  content_type?: "text" | "image";
}

export interface StorytellerLoreRequest {
  title: string;
  content: string;
  save_trigger?: "auto" | "manual";
  base_version_id?: number;
  collection_id?: string;
}

export interface StorytellerLoreCollectionRequest {
  name: string;
  description?: string;
  sort?: number;
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

// 全站作品搜尋（GET /storyteller/search）的單筆結果，文字故事／圖像作品共用同一個形狀。
// 沒有 content_type 欄位：cover_image_url 有沒有值就代表是不是圖像作品，不用重複表達。
export interface StorytellerWorkSearchResult {
  story_public_id: string;
  project_public_id: string;
  project_slug: string;
  project_name: string;
  title: string;
  summary: string;
  tags: string[];
  rating: "general" | "guidance" | "restricted";
  author_pen_name: string;
  cover_image_url?: string;
  updated_at: string;
}

// 全站作品搜尋「依專案分組」版本（GET /storyteller/search/projects）的單筆結果。
// matches 是這個專案裡命中的故事（最多幾篇，後端決定），matched_story_count 是
// 這個專案總共有幾篇故事命中——可能比 matches 顯示的還多。
export interface StorytellerProjectSearchResult {
  project_public_id: string;
  project_slug: string;
  project_name: string;
  rating: "general" | "guidance" | "restricted";
  tags: string[];
  author_pen_name: string;
  matched_story_count: number;
  matches: StorytellerWorkSearchResult[];
}
