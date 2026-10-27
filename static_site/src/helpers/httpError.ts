import axios from "axios";

// 從 API 錯誤取出 HTTP 狀態碼；不是 axios 錯誤或沒有回應（斷線、逾時）時退回 fallback。
export function httpStatusOf(error: unknown, fallback = 500) {
  return axios.isAxiosError(error)
    ? (error.response?.status ?? fallback)
    : fallback;
}

// 4xx 代表請求本身有問題（找不到、沒權限、參數錯），重送也只會得到同樣結果，
// 不該讓 TanStack Query 用預設的 retry 3 次＋退避白白多等好幾秒。
export function isClientHttpError(error: unknown) {
  const status = httpStatusOf(error, 0);
  return status >= 400 && status < 500;
}
