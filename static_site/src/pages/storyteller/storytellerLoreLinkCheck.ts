import { useStorytellerLores } from "@/apis/storyteller.ts";
import type { StorytellerLore } from "@/types/storyteller.ts";
import {
  ASSET_PUBLIC_ID_PATTERN_SOURCE,
  LORE_URI_PREFIX,
} from "./wysiwygCore/whitelist";

// 內文裡的設定連結 id（連結 marker 的 href="steamloom-lore://<id>"；圖像作品的頁面說明一樣適用）
const LORE_LINK_PATTERN = new RegExp(
  `${LORE_URI_PREFIX}(${ASSET_PUBLIC_ID_PATTERN_SOURCE})`,
  "g",
);

export function loreIdsInContent(content: string): string[] {
  return [
    ...new Set([...content.matchAll(LORE_LINK_PATTERN)].map((m) => m[1])),
  ];
}

// 公開故事／設定時的提醒：內文連到還沒公開或已刪除的設定時，讀者在那裡只會看到純文字。
// 不擋存檔（作者可能打算之後再公開那則設定），只是提醒；沒問題就回 undefined。
export function publishLoreLinkWarning(
  content: string,
  lores: StorytellerLore[],
): string | undefined {
  const loreById = new Map(lores.map((lore) => [lore.public_id, lore]));
  const unpublished: string[] = [];
  let missing = 0;
  for (const id of loreIdsInContent(content)) {
    const lore = loreById.get(id);
    if (!lore) {
      missing += 1;
    } else if (lore.status !== "completed") {
      unpublished.push(`〈${lore.title}〉`);
    }
  }
  const problems = [
    unpublished.length > 0 &&
      `${unpublished.length} 則還沒公開的設定（${unpublished.join("、")}）`,
    missing > 0 && `${missing} 個已刪除設定的連結`,
  ].filter(Boolean);
  return problems.length > 0
    ? `內文有 ${problems.join("，以及 ")}，讀者在這些地方只會看到純文字。`
    : undefined;
}

// 編輯器裡設定連結的提示樣式：已公開的照常（次要色點狀底線）、未公開的淡化、已刪除的標紅。
// CSS 只能一個 id 一條規則寫：先把所有設定連結預設成「已刪除」，再逐一蓋回存在的設定；
// 清單還在載入時不套任何規則，避免整片閃紅。
export function useLoreLinkStatusSx(projectPublicId?: string) {
  const { data: lores, isSuccess } = useStorytellerLores(projectPublicId);
  if (!projectPublicId || !isSuccess) {
    return {};
  }
  const selector = (id?: string) =>
    id
      ? `& .wysiwyg-link[href="${LORE_URI_PREFIX}${id}"]`
      : `& .wysiwyg-link[href^="${LORE_URI_PREFIX}"]`;
  return {
    [selector()]: {
      color: "error.main",
      textDecorationStyle: "wavy",
    },
    ...Object.fromEntries(
      lores.map((lore) => [
        selector(lore.public_id),
        lore.status === "completed"
          ? { color: "secondary.main", textDecorationStyle: "dotted" }
          : {
              color: "text.secondary",
              textDecorationStyle: "dotted",
              opacity: 0.75,
            },
      ]),
    ),
  };
}
