// 留言時間的相對寫法：剛剛／N 分鐘前／N 小時前／N 天前，一週以上顯示日期（yyyy/M/d）
export function relativeTime(iso: string, now = Date.now()) {
  const t = new Date(iso).getTime();
  const sec = Math.max((now - t) / 1000, 0);
  if (sec < 60) return "剛剛";
  if (sec < 3600) return `${Math.floor(sec / 60)} 分鐘前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小時前`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} 天前`;
  const d = new Date(t);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
