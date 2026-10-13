import type { EditorAsset, EditorLore, StorytellerEditorData } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { useEffect, useState } from "react";
import { backend } from "@writer/lib/backend.ts";

// Writer 版的編輯器資料來源（網站版是 react-query，見 static_site apis/storyteller/editorData.tsx）。
// 同一份資料常被好幾個地方同時要（每張資產圖片、連結對話框、失效連結標示、資產選擇對話框），用模組層快取合併請求；
// 載入失敗不跳 snack：圖片會退回節點上的 src、設定清單當作沒有，不影響寫作。
type Entry<T> = { at: number; promise: Promise<T> };
const cache = new Map<string, Entry<unknown>>();

// 設定清單在工作台建立／移動後會由 invalidateEditorLores 清掉；資產預覽是簽名網址，比網站 45 分鐘的刷新再短一點
const LORES_TTL = 5 * 60 * 1000;
const ASSET_TTL = 30 * 60 * 1000;
// 資產選擇對話框的清單：上傳／刪除後由 invalidateEditorAssets 清掉，其他情況短時間內沿用
const ASSET_LIST_TTL = 30 * 1000;

function load<T>(key: string, ttl: number, fetch: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.promise;
  const promise = fetch();
  cache.set(key, { at: Date.now(), promise });
  // 失敗的請求不留在快取，下次再試
  promise.catch(() => cache.delete(key));
  return promise;
}

function useCached<T>(key: string | null, ttl: number, fetch: () => Promise<T>) {
  const [state, setState] = useState<{ key: string | null; data?: T; done: boolean }>({ key: null, done: false });
  useEffect(() => {
    if (!key) return;
    let active = true;
    load(key, ttl, fetch)
      .then((data) => active && setState({ key, data, done: true }))
      .catch(() => active && setState({ key, done: true }));
    return () => {
      active = false;
    };
    // fetch 由 key 決定，不列入
  }, [key, ttl]);
  // key 換了但新資料還沒到時，不回舊 key 的資料
  const current = state.key === key ? state : { data: undefined, done: false };
  return { data: current.data, isSuccess: current.done && current.data !== undefined, isLoading: Boolean(key) && !current.done };
}

export const invalidateEditorLores = (project: string) => cache.delete(`lores:${project}`);
export const invalidateEditorAssets = (project: string) => {
  for (const key of cache.keys()) if (key.startsWith(`assets:${project}:`)) cache.delete(key);
};

export const writerEditorData: StorytellerEditorData = {
  useLores: (project) =>
    // Go 回傳的 status 是 string，型別上收窄成網站的 "draft" | "completed"
    useCached(project ? `lores:${project}` : null, LORES_TTL, () => backend.Lores(project!) as Promise<EditorLore[]>),
  useAsset: (project, asset) => {
    const { data, isLoading } = useCached(project && asset ? `asset:${project}:${asset}` : null, ASSET_TTL, () => backend.Asset(project!, asset!) as Promise<EditorAsset>);
    return { data, isLoading };
  },
  useAssets: (project, page, pageSize, keyword) => {
    const trimmed = keyword.trim();
    const { data, isLoading } = useCached(project ? `assets:${project}:${page}:${pageSize}:${trimmed}` : null, ASSET_LIST_TTL, () =>
      backend.Assets(project!, "", trimmed, page, pageSize),
    );
    return { data: data && { assets: data.assets ?? [], total_count: data.total_count }, isLoading };
  },
};
