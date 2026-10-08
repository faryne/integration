// 創作者頁（作者首頁／動態／收藏分頁／單則動態）的標題與描述，跟後端 service/sns/storyteller_author_meta.go 同一套格式：
// 標題「筆名 的作品／的動態／追蹤的作品／追蹤的作家」（useTitle 會補上「 | SteamLoom」）；
// 描述用自介或貼文摘要，壓成一行、截 150 字，沒有就用預設句；收藏分頁講的是別人的作品，不拿自介當描述。
// 圖一律用 SteamLoom 品牌圖卡（useTitle 預設），不用頭像。
const DESCRIPTION_MAX = 150;

const TAB_PHRASES = {
  projects: "的作品",
  posts: "的動態",
  "favorite-projects": "追蹤的作品",
  "favorite-authors": "追蹤的作家",
} as const;

export type SteamloomCreatorTab = keyof typeof TAB_PHRASES;

export function steamloomCreatorSeo(
  penName: string,
  tab: SteamloomCreatorTab,
  text?: string,
) {
  const phrase = TAB_PHRASES[tab];
  // 用 code point 計數，跟後端以 rune 截斷的結果一致
  const chars = tab.startsWith("favorite-")
    ? []
    : [...(text?.split(/\s+/).join(" ").trim() ?? "")];
  return {
    title: `${penName} ${phrase}`,
    description: chars.length
      ? chars.slice(0, DESCRIPTION_MAX).join("") +
        (chars.length > DESCRIPTION_MAX ? "…" : "")
      : `${penName} 在 SteamLoom ${phrase}。`,
  };
}
