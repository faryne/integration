import type { DocumentItem } from "@writer/lib/backend.ts";

// 每個專案記住最後打開的文件，下次打開專案直接回到那篇；最後停在 AI 助理（沒有選文件）就清掉紀錄。
// 只存在本機 webview 的 localStorage，讀寫失敗（被清除、無痕）一律當作沒有紀錄。
const key = (project: string) => `writer:last-document:${project}`;

export function readLastDocument(project: string): DocumentItem | null {
  try {
    const raw = localStorage.getItem(key(project));
    const item = raw ? (JSON.parse(raw) as DocumentItem) : null;
    return item && (item.kind === "story" || item.kind === "lore") && item.public_id ? item : null;
  } catch {
    return null;
  }
}

export function saveLastDocument(project: string, item: DocumentItem | null) {
  try {
    if (item) localStorage.setItem(key(project), JSON.stringify({ kind: item.kind, public_id: item.public_id, title: item.title, content_type: item.content_type }));
    else localStorage.removeItem(key(project));
  } catch {
    // 寫不進去只是下次回到 AI 助理，不影響編輯
  }
}
