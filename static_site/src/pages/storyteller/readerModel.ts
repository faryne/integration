import {
  parseMarkdownToParagraphs,
  storyHeadingAnchorId,
} from "@/pages/storyteller/wysiwygCore/parser.ts";
import type { HeadingLevel } from "@/pages/storyteller/wysiwygCore/whitelist.ts";
import type { StorytellerProject } from "@/types/storyteller.ts";

// ReaderItem 是故事與話（圖像作品）合併後的統一序列元素——冊現在是通用容器，
// 兩種類型可以混著放在同一冊裡，閱讀頁不再分開兩個家族，只依 sort／冊順序
// 排成一條連續的序列，用 contentType 決定要用哪種方式渲染本文。
export interface ReaderItem {
  id: string;
  contentType: "text" | "image";
  title: string;
  summary: string;
  content: string;
  sort: number;
  updatedAt: string;
  // 所屬冊的 id，null 代表未分冊；只用來在索引分組顯示，不影響上一篇/下一篇導覽
  // （導覽沿用 items 陣列本身已經是「依冊順序、未分冊排最後」排好的線性順序）。
  parentId: number | null;
  authorPenNames: string[];
}

export interface ReaderVolume {
  id: number;
  title: string;
}

export interface ReaderImagePage {
  id: string;
  imageUrl: string;
  description: string;
}

export interface ReaderProject {
  id: string;
  name: string;
  description: string;
  path: string;
  authors: Array<{
    pen_name: string;
    follower_count?: number;
  }>;
  authorPenNames: string[];
  rating: "general" | "guidance" | "restricted";
  tags: string[];
  wordCount: number;
  // 封面簽名 URL（有時效，只放在記憶體，不落地）。
  coverUrl?: string;
  coverLayout: "split" | "immersive";
  coverFocalPoint: { x: number; y: number };
  items: ReaderItem[];
  volumes: ReaderVolume[];
  // 已依設定集分組排序的設定；loreOrder 是攤平後的順序，給設定頁的上一則／下一則用
  loreGroups: ReaderLoreGroup[];
  loreOrder: ReaderLore[];
}

export interface StoryHeading {
  // lineIndex 只用來當 React key／跟 activeHeadingLine 比對「目前是哪一個」，不是拿來
  // 定位錨點——行號會因為前面內容增刪而改變，不是穩定的識別碼。
  lineIndex: number;
  level: HeadingLevel;
  text: string;
  // 實際跳轉／捲動高亮用的 DOM id：段落有 markerId（新版內容都會有）就用
  // storyHeadingAnchorId 直接定位到標題本身；沒有的話（舊資料尚未遷移）退回沿用
  // StoryContentLines 既有的 `bookmark-line-{lineIndex}` id。
  anchorId: string;
}

/** 從故事全文抽出標題清單，供側欄「本篇大綱」使用；沒有標題就回傳空陣列（呼叫端應該直接不顯示這個分頁）。 */
export function extractStoryHeadings(content: string): StoryHeading[] {
  return parseMarkdownToParagraphs(content)
    .map((paragraph, lineIndex) => ({ paragraph, lineIndex }))
    .filter(({ paragraph }) => paragraph.headingLevel > 0)
    .map(({ paragraph, lineIndex }) => ({
      lineIndex,
      level: paragraph.headingLevel,
      text: paragraph.runs
        .map((run) => run.text)
        .join("")
        .trim(),
      anchorId: paragraph.markerId
        ? storyHeadingAnchorId(paragraph.markerId)
        : `bookmark-line-${lineIndex}`,
    }))
    .filter((heading) => heading.text.length > 0);
}

export type BookmarkMode = "full" | "removeOnly" | "none";

// 閱讀頁的單則設定；collectionId 是設定集的 public_id，null 代表未歸類
export interface ReaderLore {
  id: string;
  title: string;
  summary: string;
  content: string;
  collectionId: string | null;
  updatedAt: string;
  isSpoiler: boolean;
  // 讀者要先讀完的內容（只含讀者讀得到的；讀不到的後端已經濾掉，視為已滿足）
  dependsOn: ReaderLoreDependency[];
}

export interface ReaderLoreDependency {
  type: "story" | "lore";
  id: string;
  title: string;
}

export interface ReaderLoreCollection {
  id: string;
  name: string;
}

// 設定在閱讀頁的分組：依設定集排序，未歸類（collection 為 null）排最後
export interface ReaderLoreGroup {
  collection: ReaderLoreCollection | null;
  lores: ReaderLore[];
}

// 把設定依設定集分組並排好順序。作品首頁「設定」Tab 的列表與設定頁的上一則／下一則
// 都用這個結果攤平後的順序，兩邊才不會對不上。設定集已由後端依 sort 排序、只含有公開設定的。
export function groupReaderLores(
  lores: ReaderLore[],
  collections: ReaderLoreCollection[],
): ReaderLoreGroup[] {
  const groups: ReaderLoreGroup[] = collections.map((collection) => ({
    collection,
    lores: lores.filter((lore) => lore.collectionId === collection.id),
  }));
  const known = new Set(collections.map((collection) => collection.id));
  const uncategorized = lores.filter(
    (lore) => !lore.collectionId || !known.has(lore.collectionId),
  );
  if (uncategorized.length > 0) {
    groups.push({ collection: null, lores: uncategorized });
  }
  return groups.filter((group) => group.lores.length > 0);
}

// 劇透依賴的種類標示：圖像作品在產品裡也算「故事」，所以只分故事與設定兩種
export const LORE_DEPENDENCY_TYPE_LABEL = {
  story: "故事",
  lore: "設定",
} as const;

// 作品首頁的兩個 Tab：故事（work/:projectPath）、設定（work/:projectPath/lores）
export type ReaderLandingTab = "stories" | "lores" | "discussions";

// 把公開專案 API 的設定與設定集轉成閱讀頁用的分組與攤平順序
export function readerLoresFromProject(
  project: Pick<StorytellerProject, "lores" | "lore_collections">,
): Pick<ReaderProject, "loreGroups" | "loreOrder"> {
  const loreGroups = groupReaderLores(
    (project.lores ?? []).map((lore) => ({
      id: lore.public_id,
      title: lore.title,
      summary: lore.summary,
      content: lore.latest_content,
      collectionId: lore.collection_id ?? null,
      updatedAt: lore.updated_at,
      isSpoiler: Boolean(lore.is_spoiler),
      dependsOn: (lore.depends_on ?? []).map((dependency) => ({
        type: dependency.target_type,
        id: dependency.target_public_id,
        title: dependency.title ?? "",
      })),
    })),
    (project.lore_collections ?? []).map((collection) => ({
      id: collection.public_id,
      name: collection.name,
    })),
  );
  return {
    loreGroups,
    loreOrder: loreGroups.flatMap((group) => group.lores),
  };
}

// 設定 Tab 裡每個設定集區塊的錨點 id，設定頁麵包屑的設定集連結用 #錨點 捲到對應區塊
export const readerLoreGroupAnchorId = (collectionId: string | null) =>
  `lore-group-${collectionId ?? "uncategorized"}`;

export function plainTextFromMarkdown(content: string): string {
  return parseMarkdownToParagraphs(content)
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(""))
    .join(" ")
    .trim();
}
