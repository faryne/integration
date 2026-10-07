import { useState } from "react";
import type { ReaderLore } from "./readerModel.ts";
import {
  readingTargetKey,
  type ReaderProgressMap,
} from "./readingRecordStore.ts";

// 鎖住的劇透設定在列表、麵包屑、分頁標題上的替代標題：設定標題本身常常就是劇透
export const SPOILER_LORE_TITLE = "含劇透的設定";

const storageKey = (projectPublicId: string) =>
  `steamloom.spoiler-confirmed.${projectPublicId}`;

// localStorage 可能被封鎖或丟例外，讀不到就當作沒確認過（多問一次而已）
function loadConfirmed(projectPublicId?: string): Set<string> {
  if (!projectPublicId) return new Set();
  try {
    const raw = window.localStorage.getItem(storageKey(projectPublicId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

// 防劇透是軟性閘門（UX，不是權限）：含劇透的設定在讀者「讀完所有依賴」或「按過確認」之前是鎖住的；
// 沒有依賴的劇透設定只能靠確認解鎖。確認記在這台裝置上，下次不用再問；確認本身不算閱讀進度。
export function useLoreSpoilerGate(
  projectPublicId: string | undefined,
  progressMap: ReaderProgressMap,
) {
  const [confirmedProjectId, setConfirmedProjectId] = useState(projectPublicId);
  const [confirmed, setConfirmed] = useState(() =>
    loadConfirmed(projectPublicId),
  );
  // 換作品時在 render 階段重新載入（React 官方建議的「依 props 調整 state」寫法）
  if (confirmedProjectId !== projectPublicId) {
    setConfirmedProjectId(projectPublicId);
    setConfirmed(loadConfirmed(projectPublicId));
  }

  const unmetDependencies = (lore: ReaderLore) =>
    lore.dependsOn.filter(
      (dependency) =>
        !progressMap[readingTargetKey(dependency.type, dependency.id)]
          ?.completed,
    );

  const isLocked = (lore: ReaderLore) =>
    lore.isSpoiler &&
    !confirmed.has(lore.id) &&
    (lore.dependsOn.length === 0 || unmetDependencies(lore).length > 0);

  const confirm = (loreId: string) => {
    if (!projectPublicId) return;
    const next = new Set(confirmed).add(loreId);
    setConfirmed(next);
    try {
      window.localStorage.setItem(
        storageKey(projectPublicId),
        JSON.stringify([...next]),
      );
    } catch {
      // 寫不進去就只在這次瀏覽有效
    }
  };

  return {
    isLocked,
    unmetDependencies,
    confirm,
    // 列表與標題用：鎖住時換成替代標題
    displayTitle: (lore: ReaderLore) =>
      isLocked(lore) ? SPOILER_LORE_TITLE : lore.title,
  };
}
