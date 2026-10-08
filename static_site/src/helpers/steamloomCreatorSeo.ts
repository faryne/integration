// 創作者頁（作者首頁／動態列表／單則動態）的標題與描述，跟後端 service/sns/storyteller_author_meta.go 同一套格式：
// 標題「筆名 的作品／動態」（useTitle 會補上「 | SteamLoom」）；描述用自介或貼文摘要，壓成一行、截 150 字，沒有就用預設句。
const DESCRIPTION_MAX = 150;

export function steamloomCreatorSeo(
  penName: string,
  page: "作品" | "動態",
  text?: string,
) {
  // 用 code point 計數，跟後端以 rune 截斷的結果一致
  const chars = [...(text?.split(/\s+/).join(" ").trim() ?? "")];
  return {
    title: `${penName} 的${page}`,
    description: chars.length
      ? chars.slice(0, DESCRIPTION_MAX).join("") +
        (chars.length > DESCRIPTION_MAX ? "…" : "")
      : `${penName} 在 SteamLoom 的${page}。`,
  };
}
