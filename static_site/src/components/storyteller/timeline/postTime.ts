import i18n from "i18next";

// 動態與留言的相對時間：一小時內寫分鐘、今天寫小時、昨天、今年只寫月日，更早加上年份
// 非元件 helper，取全域 i18next；每次 render 呼叫，拿得到目前語系
export function postTimeLabel(iso: string) {
  const date = new Date(iso);
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return i18n.t("web.timeline.time.justNow");
  if (minutes < 60)
    return i18n.t("web.timeline.time.minutesAgo", { count: minutes });
  if (minutes < 24 * 60)
    return i18n.t("web.timeline.time.hoursAgo", {
      count: Math.floor(minutes / 60),
    });
  if (minutes < 48 * 60) return i18n.t("web.timeline.time.yesterday");
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(i18n.resolvedLanguage, {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric",
  });
}

export const postFullTime = (iso: string) =>
  new Date(iso).toLocaleString(i18n.resolvedLanguage, { hour12: false });
