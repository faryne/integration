export const apiBase = import.meta.env.VITE_API_BASE;

// storyteller 資產圖片的 CloudFront 簽名網址 TTL 是 1 小時（見後端 cloudfront.go 的
// imageCloudFrontSignatureTTL），閱讀頁/編輯頁如果開超過一小時，畫面上還留著的舊簽名
// 網址就會過期、圖片變成 403。這幾個 query 定時重新抓取換新簽名網址，抓 45 分鐘留足夠
// 安全邊界；只在分頁有焦點時才會觸發（TanStack Query 的 refetchIntervalInBackground
// 預設 false），分頁切到背景太久再切回來則是靠預設的 refetchOnWindowFocus 補上，
// 不需要另外處理。
export const ASSET_URL_REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}
