/**
 * 工作台是登入後最常從專案卡進入的較大 chunk；集中 loader 讓 router lazy 與首頁預載
 * 共用同一個 dynamic import，瀏覽器只會下載一次。
 */
export const loadStorytellerProjectWorkspace = () =>
  import("@/pages/storyteller/ProjectWorkspacePreview.tsx");
