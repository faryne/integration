// 動態與留言的相對時間：一小時內寫分鐘、今天寫小時、昨天、今年只寫月日，更早加上年份
export function postTimeLabel(iso: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} 小時前`;
  if (minutes < 48 * 60) return "昨天";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("zh-TW", {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric",
  });
}

export const postFullTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", { hour12: false });
