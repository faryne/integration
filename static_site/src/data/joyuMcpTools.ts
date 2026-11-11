// joyu.fyi MCP 工具頁的中文名稱、說明與分組（key＝後端工具名稱）。
// 後端新增工具但這裡沒補時，頁面會放進「其他」組並顯示英文描述；ping 只是測試連線，不顯示

/** 頁面上對外顯示的連線網址（nginx 把 joyu.fyi/mcp 改寫到後端 /joyu-mcp） */
export const JOYU_MCP_ENDPOINT = "https://joyu.fyi/mcp";
/** 連線教學裡建議的伺服器名稱 */
export const JOYU_MCP_NAME = "joyu";

export const JOYU_MCP_HIDDEN_TOOLS = ["ping"];

/** 分組顯示順序；沒有對照的工具一律進最後的「其他」 */
export const JOYU_MCP_GROUPS = ["搜尋", "上稿", "查審核結果", "其他"] as const;
export type JoyuMcpGroup = (typeof JOYU_MCP_GROUPS)[number];

export const JOYU_MCP_TOOL_META: Record<
  string,
  { group: JoyuMcpGroup; title: string; description: string }
> = {
  av_video_search: {
    group: "搜尋",
    title: "影片搜尋",
    description:
      "依關鍵字、女優、標籤、品牌、系列、監督、番號、日期、片長搜尋影片；可順便回傳常見標籤／品牌統計。",
  },
  av_actress_search: {
    group: "搜尋",
    title: "女優搜尋",
    description: "依名字、身高、三圍、罩杯、生日、血型搜尋女優。",
  },
  av_actress_submit: {
    group: "上稿",
    title: "女優上稿",
    description: "新增女優或修改既有女優資料，送管理員審核。",
  },
  av_video_submit: {
    group: "上稿",
    title: "影片修改",
    description: "修改影片資料，送管理員審核。",
  },
  av_actress_submission_status: {
    group: "查審核結果",
    title: "女優上稿結果",
    description: "用上稿編號查審核狀態。",
  },
  av_video_submission_status: {
    group: "查審核結果",
    title: "影片修改結果",
    description: "用上稿編號查審核狀態。",
  },
};
