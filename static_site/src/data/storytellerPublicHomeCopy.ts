/**
 * 首頁 Hero 只從完整配對中抽選；直接編輯這個常數即可增刪文案。
 * 站內不內建 AI 助理（2026-10-03 起），AI 一律走使用者自己的工具＋MCP，文案不要再暗示網頁裡有 AI 代勞。
 */
export const STORYTELLER_PUBLIC_HOME_COPIES = [
  {
    title: "用你習慣的 AI，",
    accent: "直接寫進故事裡。",
    lead: "Claude、ChatGPT、Codex 透過 MCP 連上 SteamLoom，就能讀設定、續寫章節、改完直接存檔，不用再複製貼上。",
  },
  {
    title: "換一個 AI，",
    accent: "也不用從頭交代。",
    lead: "文風偏好、寫作規矩、定案的劇情都存成梭梭的記憶，不管從哪個 AI 連進來，動筆前都會先讀過。",
  },
  {
    title: "世界觀越長越大，",
    accent: "AI 也查得到。",
    lead: "人物、場景、章節和設定集收在同一個專案裡，AI 寫之前會自己搜尋、對照設定，不會越寫越矛盾。",
  },
  {
    title: "故事不只需要完成，",
    accent: "還需要被看見。",
    lead: "從私人草稿到公開連載，在不打斷創作節奏的地方整理、發表，然後繼續寫下去。",
  },
] as const;
