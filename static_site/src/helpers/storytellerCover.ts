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

// 焦點只有「沉浸式」版型才需要——那種版型裁切幅度大，容易把人物切出畫面；圖文分區
// 跟卡片縮圖本來裁切就少，統一置中即可，不需要創作者為了這個再去校正焦點，設定頁
// 的拖曳準星也只在沉浸式版型才會出現。任何地方要裁封面圖，都透過這個函式決定
// object-position／background-position，確保設定頁預覽跟目次頁 Hero 一致。
// 專案卡橫幅刻意不吃這個焦點（見 StorytellerProjectCoverBanner），卡片欄寬隨版面
// 變動、裁切比例不穩定，硬套 Hero 校準過的焦點在窄幅縮圖反而更容易「切歪」。
export function storytellerCoverObjectPosition(
  coverLayout: "split" | "immersive" | undefined,
  coverFocalPoint: { x: number; y: number } | undefined,
) {
  if (coverLayout !== "immersive" || !coverFocalPoint) {
    return "50% 50%";
  }
  return `${coverFocalPoint.x * 100}% ${coverFocalPoint.y * 100}%`;
}

// 沉浸式封面在目次頁 Hero 的實際裁切比例（見 ReaderWorkLanding 的 contentWidth／
// minHeight），設定頁預覽要用同一個比例，創作者拖焦點時看到的才會跟 Hero 一致。
export const STORYTELLER_COVER_HERO_ASPECT_RATIO = 1200 / 360;
