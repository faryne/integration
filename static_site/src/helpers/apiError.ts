import axios from "axios";

// 後端 output 統一格式的錯誤訊息（message 欄位）；沒有就用 fallback。snack 顯示用。
export function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)
      ?.message;
    if (message) return message;
  }
  return fallback;
}
