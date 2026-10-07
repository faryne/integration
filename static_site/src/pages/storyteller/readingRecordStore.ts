import type {
  StorytellerReadingRecord,
  StorytellerReadingRecordInput,
  StorytellerReadingTargetType,
} from "@/apis/storyteller.ts";

// 閱讀進度在前端的統一形狀：登入讀者來自 API、未登入讀者來自 localStorage，兩邊轉成同一種，
// 列表與「繼續閱讀」就不用管資料從哪來。
export interface ReaderProgress {
  progress: number;
  completed: boolean;
  updatedAt: string;
}

export type ReaderProgressMap = Record<string, ReaderProgress>;

// 進度至少要往前推這麼多才回報，避免每捲一點就寫一次
export const READING_PROGRESS_STEP = 5;
// 進度值要穩定這麼久才算數：換篇時捲動位置會晚一拍跟上，中間的暫態值（例如上一篇捲到底、
// 新篇內容剛換上去那一瞬間算出 100%）不能被記成新篇已讀完
export const READING_PROGRESS_SETTLE_MS = 1500;
// 登入讀者的寫入 debounce，連續閱讀時合併成一次請求
export const READING_PROGRESS_FLUSH_MS = 3000;

export const readingTargetKey = (
  type: StorytellerReadingTargetType,
  publicId: string,
) => `${type}:${publicId}`;

const storageKey = (projectPublicId: string) =>
  `steamloom.reading.${projectPublicId}`;

export function fromServerRecords(
  records: StorytellerReadingRecord[],
): ReaderProgressMap {
  return Object.fromEntries(
    records.map((record) => [
      readingTargetKey(record.target_type, record.target_public_id),
      {
        progress: record.progress,
        completed: Boolean(record.completed_at),
        updatedAt: record.updated_at,
      },
    ]),
  );
}

// 判斷新進度值不值得寫入：至少前進一個 step，或是剛好讀到 100%（讀完一定要記到）
export function shouldRecordProgress(
  current: ReaderProgress | undefined,
  next: number,
) {
  const previous = current?.progress ?? 0;
  return (
    next >= previous + READING_PROGRESS_STEP ||
    (next >= 100 && !current?.completed)
  );
}

// 把新進度合併進既有紀錄：進度只增不減、讀完狀態不會被取消，跟後端 upsert 規則一致
export function mergeProgress(
  map: ReaderProgressMap,
  key: string,
  next: number,
): ReaderProgressMap {
  const current = map[key];
  const progress = Math.min(100, Math.max(current?.progress ?? 0, next));
  return {
    ...map,
    [key]: {
      progress,
      completed: Boolean(current?.completed) || progress >= 100,
      updatedAt:
        progress > (current?.progress ?? 0)
          ? new Date().toISOString()
          : (current?.updatedAt ?? new Date().toISOString()),
    },
  };
}

export function toRecordInputs(
  map: ReaderProgressMap,
): StorytellerReadingRecordInput[] {
  return Object.entries(map).map(([key, value]) => {
    const [type, ...rest] = key.split(":");
    return {
      target_type: type as StorytellerReadingTargetType,
      target_public_id: rest.join(":"),
      progress: value.progress,
    };
  });
}

// localStorage 在無痕模式、被封鎖或容量滿時可能直接丟例外，讀寫一律包 try/catch，
// 失敗就當作沒有紀錄——閱讀進度是輔助資訊，不能因此讓閱讀頁壞掉。
export function loadLocalReadingProgress(
  projectPublicId?: string,
): ReaderProgressMap {
  if (!projectPublicId) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(storageKey(projectPublicId));
    return raw ? (JSON.parse(raw) as ReaderProgressMap) : {};
  } catch {
    return {};
  }
}

export function saveLocalReadingProgress(
  projectPublicId: string,
  map: ReaderProgressMap,
) {
  try {
    if (Object.keys(map).length === 0) {
      window.localStorage.removeItem(storageKey(projectPublicId));
    } else {
      window.localStorage.setItem(
        storageKey(projectPublicId),
        JSON.stringify(map),
      );
    }
  } catch {
    // 寫不進去就算了，見 loadLocalReadingProgress 的說明
  }
}
