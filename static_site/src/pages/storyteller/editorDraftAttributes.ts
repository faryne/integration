// 編輯頁（StoryEditor／LoreEditor／ImageEpisodeEditor）判斷未存檔用的「已存檔」基準是整份草稿序列化成的 JSON 字串。
// 狀態、冊／設定集、署名改成一變更就走 PATCH 即時存（不寫版本、不進編輯歷史），存好後只把基準裡的這幾個欄位
// 換成新值；標題、內文等其他欄位維持原本的已存檔值，作者還沒存的內容修改照樣算未存檔。
// 物件展開會保留原本的 key 順序，跟各編輯頁 serialize 出來的字串可以直接比對。
export function withDraftAttributes(
  serialized: string,
  attributes: Record<string, unknown>,
) {
  return JSON.stringify({ ...JSON.parse(serialized), ...attributes });
}
