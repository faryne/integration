import { useAgeConfirmed } from "@/helpers/ageConfirmation.ts";

// 限制級專案的封面要有年齡確認 cookie（nekomaid_r18_confirmed）才顯示。
// 純前端判斷：API 仍照常回傳 cover_url，這裡只決定要不要拿來渲染；
// 按下「我已滿 18 歲」後 useAgeConfirmed 會即時更新，封面不用重新整理就出現。
export function useGatedCoverUrl(
  coverUrl: string | undefined,
  rating: string | undefined,
) {
  const confirmed = useAgeConfirmed();
  return rating === "restricted" && !confirmed ? undefined : coverUrl;
}
