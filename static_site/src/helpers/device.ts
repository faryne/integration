// 用 UA 判斷是不是手機（平板不算）；同時播放多部影片這類功能在手機上直接不提供
export const isMobileUserAgent = () =>
  typeof navigator !== "undefined" &&
  /iPhone|iPod|Android.+Mobile|Windows Phone|Mobi/i.test(navigator.userAgent);
