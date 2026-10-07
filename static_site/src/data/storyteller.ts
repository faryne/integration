import {
  readerProjectBasePath,
  readerStoryPath,
} from "@/helpers/storytellerReaderPaths.ts";

// 品牌名稱還沒定案，先集中在這裡管理——之後改名只要改這個常數，不用整個專案找字串取代。
export const STORYTELLER_APP_NAME = "SteamLoom";

// 站內 AI 助理開關（對應後端 STORYTELLER_AI_ASSISTANT_ENABLED）：2026-10-03 起刻意停用，
// 改以 MCP 為主要 AI 路徑；關閉時藏起編輯器「問 AI」、Skill／金鑰管理／用量報表入口，
// AI 相關 query 也不發請求。程式碼暫時保留，本機要測試時設 VITE_STORYTELLER_AI_ASSISTANT_ENABLED=true。
export const STORYTELLER_AI_ASSISTANT_ENABLED =
  import.meta.env.VITE_STORYTELLER_AI_ASSISTANT_ENABLED === "true";

// 專案公開範圍的中文名稱；專案卡片選單與稽核紀錄的欄位差異共用同一份，避免兩邊講法不同。
export const STORYTELLER_VISIBILITY_LABELS = {
  private: "私密",
  unlisted: "分享",
  public: "公開",
} satisfies Record<"private" | "unlisted" | "public", string>;

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

// 雛形期留下的示範 Agent：StoryEditor 在 API 回傳空清單時拿來墊底，所以還不能刪。
export interface StorytellerAgent {
  id: string;
  name: string;
  purpose: string;
  projectCount: number;
  updatedAt: string;
  enabled: boolean;
}

export const storytellerAgents: StorytellerAgent[] = [
  {
    id: "ag-plot-doctor",
    name: "Plot Doctor",
    purpose: "檢查章節節奏、伏筆回收與角色動機一致性。",
    projectCount: 2,
    updatedAt: "2026-06-21T13:20:00+08:00",
    enabled: true,
  },
  {
    id: "ag-scene-continuator",
    name: "Scene Continuator",
    purpose: "依選取段落延伸下一段，保持既有敘事口吻。",
    projectCount: 3,
    updatedAt: "2026-06-19T16:05:00+08:00",
    enabled: true,
  },
  {
    id: "ag-lore-keeper",
    name: "Lore Keeper",
    purpose: "整理設定集、名詞表與跨章節時間線。",
    projectCount: 1,
    updatedAt: "2026-06-10T11:00:00+08:00",
    enabled: false,
  },
];

// 作品首頁（故事 Tab）：work/:projectPath，網址規則見 helpers/storytellerReaderPaths.ts
export function storytellerReaderPath(project: {
  public_id: string;
  slug: string;
}) {
  return readerProjectBasePath(`${project.public_id}-${project.slug}`);
}

// storytellerSearchResultPath 組出搜尋結果單篇作品的閱讀連結；文字故事與圖像作品共用 story/:id。
export function storytellerSearchResultPath(result: {
  project_public_id: string;
  project_slug: string;
  story_public_id: string;
  cover_image_url?: string;
}) {
  return readerStoryPath(
    readerProjectBasePath(`${result.project_public_id}-${result.project_slug}`),
    result.story_public_id,
  );
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
