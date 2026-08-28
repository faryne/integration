import { steamloomPath } from "@/helpers/steamloom.ts";

// 品牌名稱還沒定案，先集中在這裡管理——之後改名只要改這個常數，不用整個專案找字串取代。
export const STORYTELLER_APP_NAME = "SteamLoom";

// 圖像作品上傳限制：跟後端 service/storyteller/upload.go 的
// maxImagePagesPerUpload／maxImagePageSizeBytes／allowedImagePageContentTypes 對應，
// 前端這邊只是先擋一次給使用者即時回饋，實際防濫用還是靠後端驗證。
export const STORYTELLER_IMAGE_PAGE_MAX_COUNT = 60;
export const STORYTELLER_IMAGE_PAGE_MAX_BYTES = 15 * 1024 * 1024;
export const STORYTELLER_IMAGE_PAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export interface StorytellerProject {
  id: string;
  publicId: string;
  name: string;
  slug: string;
  description: string;
  storiesCount: number;
  updatedAt: string;
  status: "drafting" | "planning" | "paused";
  visibility: "public" | "unlisted" | "private";
  shareToken?: string;
}

export interface StorytellerAgent {
  id: string;
  name: string;
  provider: string;
  model: string;
  purpose: string;
  projectCount: number;
  updatedAt: string;
  enabled: boolean;
}

export interface StorytellerStory {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  words: number;
  updatedAt: string;
  content: string;
}

export interface StorytellerStoryDiff {
  id: string;
  storyId: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
  words: number;
}

export const storytellerProjects: StorytellerProject[] = [
  {
    id: "pj-river-lantern",
    publicId: "river8x4",
    name: "河燈之城",
    slug: "river-lantern",
    description:
      "架空港都奇幻長篇。主線聚焦在失蹤的記憶、河神信仰，以及城市改建後浮出的舊契約。",
    storiesCount: 8,
    updatedAt: "2026-06-20T18:30:00+08:00",
    status: "drafting",
    visibility: "public",
    shareToken: "river-lantern-friends",
  },
  {
    id: "pj-copper-sky",
    publicId: "sky9k2",
    name: "銅色天空檔案",
    slug: "copper-sky",
    description: "近未來懸疑短篇集。每篇以同一座軌道城市中的匿名委託為開場。",
    storiesCount: 4,
    updatedAt: "2026-06-18T09:10:00+08:00",
    status: "planning",
    visibility: "public",
  },
  {
    id: "pj-quiet-market",
    publicId: "night7m1",
    name: "夜市熄燈以後",
    slug: "quiet-market",
    description: "都市怪談企劃，整理角色、場景與章節草稿用。",
    storiesCount: 2,
    updatedAt: "2026-06-12T22:45:00+08:00",
    status: "paused",
    visibility: "private",
    shareToken: "quiet-market-private",
  },
];

export const storytellerAgents: StorytellerAgent[] = [
  {
    id: "ag-plot-doctor",
    name: "Plot Doctor",
    provider: "Grok",
    model: "grok-4",
    purpose: "檢查章節節奏、伏筆回收與角色動機一致性。",
    projectCount: 2,
    updatedAt: "2026-06-21T13:20:00+08:00",
    enabled: true,
  },
  {
    id: "ag-scene-continuator",
    name: "Scene Continuator",
    provider: "Grok",
    model: "grok-4-fast",
    purpose: "依選取段落延伸下一段，保持既有敘事口吻。",
    projectCount: 3,
    updatedAt: "2026-06-19T16:05:00+08:00",
    enabled: true,
  },
  {
    id: "ag-lore-keeper",
    name: "Lore Keeper",
    provider: "OpenAI compatible",
    model: "未設定",
    purpose: "整理設定集、名詞表與跨章節時間線。",
    projectCount: 1,
    updatedAt: "2026-06-10T11:00:00+08:00",
    enabled: false,
  },
];

export const storytellerStories: StorytellerStory[] = [
  {
    id: "story-01",
    projectId: "pj-river-lantern",
    title: "第一章：潮線以下",
    summary: "主角回到港都，發現河岸改建工地挖出舊神龕。",
    words: 4200,
    updatedAt: "2026-06-20T18:30:00+08:00",
    content: `# 第一章：潮線以下

雨從傍晚開始落下，沿著港邊的霓虹招牌往下爬，把整座城市洗成一片濕亮的藍。

林岫提著行李箱站在河堤上，看見工地圍籬後方露出半截石龕。那不是她記憶中的東西。至少在她離開這座城市以前，河岸邊只有賣烤魷魚的小攤、三間永遠不會準時開門的雜貨店，以及每年中元節都會漂滿河面的紙燈。

她把手機拿起來，對準石龕拍照。快門聲落下的瞬間，河面上有什麼東西亮了一下。

像一盞燈，也像一隻眼睛。`,
  },
  {
    id: "story-02",
    projectId: "pj-river-lantern",
    title: "第二章：無名契約",
    summary: "工地主任交出一份沒有署名的土地契約。",
    words: 3800,
    updatedAt: "2026-06-18T21:00:00+08:00",
    content: `# 第二章：無名契約

契約紙很薄，邊緣泛黃，卻沒有任何潮氣侵蝕的痕跡。

林岫用指腹碰了一下紙面，墨跡像是剛乾，黑得近乎刺眼。`,
  },
  {
    id: "story-03",
    projectId: "pj-river-lantern",
    title: "角色設定與年表",
    summary: "主要人物、城市背景與時間線整理。",
    words: 1900,
    updatedAt: "2026-06-15T14:20:00+08:00",
    content: `# 角色設定與年表

## 林岫

- 年齡：29
- 職業：都市更新顧問
- 核心矛盾：不相信故鄉傳說，卻比任何人都清楚祭典細節。`,
  },
];

export const storytellerStoryDiffs: StorytellerStoryDiff[] = [
  {
    id: "diff-20260620-1830",
    storyId: "story-01",
    title: "第一章：潮線以下",
    content: `# 第一章：潮線以下

雨從傍晚開始落下，沿著港邊的霓虹招牌往下爬，把整座城市洗成一片濕亮的藍。

林岫提著行李箱站在河堤上，看見工地圍籬後方露出半截石龕。那不是她記憶中的東西。至少在她離開這座城市以前，河岸邊只有賣烤魷魚的小攤、三間永遠不會準時開門的雜貨店，以及每年中元節都會漂滿河面的紙燈。

她把手機拿起來，對準石龕拍照。快門聲落下的瞬間，河面上有什麼東西亮了一下。

像一盞燈，也像一隻眼睛。`,
    source: "手動編輯",
    createdAt: "2026-06-20T18:30:00+08:00",
    words: 4200,
  },
  {
    id: "diff-20260620-1805",
    storyId: "story-01",
    title: "第一章：潮線之下",
    content: `# 第一章：潮線之下

雨從傍晚開始落下，沿著港邊的霓虹招牌往下爬，把整座城市洗成一片濕亮的藍。

林岫提著行李箱站在河堤上，看見工地圍籬後方露出半截石龕。那不是她記憶中的東西。至少在她離開這座城市以前，河岸邊只有賣烤魷魚的小攤、兩間永遠不會準時開門的雜貨店，以及每年中元節都會漂滿河面的紙燈。

她把手機拿起來，對準石龕拍照。快門聲落下的瞬間，河面像被誰從底下點亮。

那光不像燈，比較像一隻在水底睜開的眼睛。`,
    source: "Plot Doctor",
    createdAt: "2026-06-20T18:05:00+08:00",
    words: 4120,
  },
  {
    id: "diff-20260619-2212",
    storyId: "story-01",
    title: "第一章：潮線以下",
    content: `# 第一章：潮線以下

雨從傍晚開始落下，把整座城市洗成一片濕亮的藍。

林岫提著行李箱站在河堤上，看見工地圍籬後方露出半截石龕。那不是她記憶中的東西。

她把手機拿起來，對準石龕拍照。快門聲落下的瞬間，河面上有什麼東西亮了一下。`,
    source: "手動編輯",
    createdAt: "2026-06-19T22:12:00+08:00",
    words: 3600,
  },
  {
    id: "diff-20260618-2100",
    storyId: "story-02",
    title: "第二章：無名契約",
    content: `# 第二章：無名契約

契約紙很薄，邊緣泛黃，卻沒有任何潮氣侵蝕的痕跡。

林岫用指腹碰了一下紙面，墨跡像是剛乾，黑得近乎刺眼。`,
    source: "手動編輯",
    createdAt: "2026-06-18T21:00:00+08:00",
    words: 3800,
  },
];

export function getProjectStories(projectId: string) {
  return storytellerStories.filter((story) => story.projectId === projectId);
}

export function publicProjectPath(project: StorytellerProject) {
  return steamloomPath(`story/${project.publicId}-${project.slug}`);
}

// storytellerImageEpisodeCount 算一個專案有幾話（content_type=image 的故事）。
// project.stories 在專案列表／詳情 API 裡已經內含，不用另外打 API 拿。
export function storytellerImageEpisodeCount(
  stories: Array<{ content_type: "text" | "image" }> | undefined,
) {
  return (stories ?? []).filter((story) => story.content_type === "image")
    .length;
}

// 故事與話已經合併成同一份依序排列的序列，閱讀頁不再分故事/圖像兩個家族，
// 一律連到 stories 這個統一入口（序列裡第一篇是誰由後端排序決定，不用在這裡猜）。
export function storytellerReaderPath(project: {
  public_id: string;
  slug: string;
}) {
  const family = "stories";
  return steamloomPath(`work/${project.public_id}-${project.slug}/${family}`);
}

// storytellerSearchResultPath 組出搜尋結果單篇作品的閱讀連結。沒有 content_type 欄位可以
// 判斷文字/圖像，靠 cover_image_url 有沒有值反推（圖像作品才會有封面），跟卡片本身判斷
// 要不要顯示縮圖是同一個依據，兩處故意用同一個欄位以避免不一致。
export function storytellerSearchResultPath(result: {
  project_public_id: string;
  project_slug: string;
  story_public_id: string;
  cover_image_url?: string;
}) {
  const projectPath = `${result.project_public_id}-${result.project_slug}`;
  const family = result.cover_image_url ? "image" : "story";
  return steamloomPath(`work/${projectPath}/${family}/${result.story_public_id}`);
}

export function getPublicProjects() {
  return storytellerProjects.filter(
    (project) => project.visibility === "public",
  );
}

export function findProjectByPublicPath(projectPath: string) {
  return storytellerProjects.find(
    (project) => `${project.publicId}-${project.slug}` === projectPath,
  );
}

export function findProjectByShareToken(shareToken: string) {
  return storytellerProjects.find(
    (project) => project.shareToken === shareToken,
  );
}

export function getStoryDiffs(storyId: string) {
  return storytellerStoryDiffs.filter((diff) => diff.storyId === storyId);
}

export function formatStorytellerDate(input: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(input));
}

export function storytellerProjectRatingLabel(
  rating: "general" | "guidance" | "restricted" | undefined,
) {
  if (rating === "restricted") {
    return "限制級";
  }
  if (rating === "guidance") {
    return "輔導級";
  }
  return "普通級";
}

export function storytellerProjectRatingColor(
  rating: "general" | "guidance" | "restricted" | undefined,
) {
  if (rating === "restricted") {
    return "error";
  }
  if (rating === "guidance") {
    return "warning";
  }
  return "success";
}

// 對應後端 story/lore version 的 source 欄位：web_auto／web_manual／web_agent_apply
// 是網頁編輯頁自己存的，"mcp:<token label>" 是外部工具透過 MCP 用哪把 Personal
// Access Token 寫入的。source 可能因為資料庫還沒跑過補欄位的 migration、或本來
// 就是舊資料而缺值，一律當手動存檔。
export function storytellerVersionSourceLabel(
  source: string | null | undefined,
) {
  if (!source) {
    return "手動存檔";
  }
  if (source === "web_auto") {
    return "自動存檔";
  }
  if (source === "web_agent_apply") {
    return "套用 AI 提案存檔";
  }
  if (source.startsWith("mcp:")) {
    const label = source.slice("mcp:".length);
    return label ? `透過 MCP 使用 PAT「${label}」操作` : "透過 MCP 操作";
  }
  return "手動存檔";
}

export function projectStatusLabel(status: StorytellerProject["status"]) {
  if (status === "drafting") {
    return "撰寫中";
  }
  if (status === "planning") {
    return "規劃中";
  }
  return "暫停";
}
