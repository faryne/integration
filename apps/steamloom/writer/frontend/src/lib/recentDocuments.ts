import type { DocumentItem } from "@writer/lib/backend.ts";

// 每個專案在本機 webview 的 localStorage 記兩件事：
// - 最後打開的文件：下次打開專案直接回到那篇；最後停在 AI 助理（沒有選文件）就清掉
// - 最近開啟清單：⌘K 搜尋對話框沒輸入關鍵字時列出
// 讀寫失敗（被清除、無痕）一律當作沒有紀錄，不影響編輯。
const lastKey = (project: string) => `writer:last-document:${project}`;
const recentKey = (project: string) => `writer:recent-documents:${project}`;
const recentLimit = 8;

const pick = (item: DocumentItem) => ({ kind: item.kind, public_id: item.public_id, title: item.title, content_type: item.content_type });
const valid = (item: unknown): item is DocumentItem =>
  Boolean(item) && ((item as DocumentItem).kind === "story" || (item as DocumentItem).kind === "lore") && Boolean((item as DocumentItem).public_id);

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 寫不進去只是少了這份紀錄
  }
}

export function readLastDocument(project: string): DocumentItem | null {
  const item = read<unknown>(lastKey(project), null);
  return valid(item) ? item : null;
}

export function readRecentDocuments(project: string): DocumentItem[] {
  const items = read<unknown[]>(recentKey(project), []);
  return Array.isArray(items) ? items.filter(valid) : [];
}

// 打開文件時呼叫：更新最後一篇，並把它移到最近開啟清單最前面；傳 null（回到 AI 助理）只清掉最後一篇
export function rememberDocument(project: string, item: DocumentItem | null) {
  write(lastKey(project), item && pick(item));
  if (!item) return;
  const rest = readRecentDocuments(project).filter((each) => !(each.kind === item.kind && each.public_id === item.public_id));
  write(recentKey(project), [pick(item), ...rest].slice(0, recentLimit));
}
