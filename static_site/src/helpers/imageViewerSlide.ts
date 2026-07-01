// ImageViewer carousel 換頁時的滑動動畫工具。
// 按鈕、鍵盤左右鍵、觸控滑動、縮圖點擊最終都會呼叫同一個 goTo()，
// 因此在這裡共用同一套動畫時間軸與位移計算，避免各進入點各自實作造成不一致。

// 換頁動畫持續時間（毫秒）。
export const SLIDE_DURATION = 280;

// 換頁時「正在退場」的那張圖片資訊。
// direction: 1 表示往下一張（新圖從右側滑入、舊圖往左滑出）；
//            -1 表示往上一張（新圖從左側滑入、舊圖往右滑出）。
export interface SlideTransition {
  direction: 1 | -1;
  index: number;
  photo: { url: string };
}

// 依「是否已進場」與「退場／進場」算出對應的 translateX。
// entered=false 為動畫起始位置，entered=true 為動畫結束（定案）位置。
export function slideTransform(
  entered: boolean,
  isOutgoing: boolean,
  direction: 1 | -1,
) {
  if (isOutgoing) {
    // 退場圖片：一開始待在原地，進場旗標打開後往換頁方向的反方向滑出。
    return entered ? `translateX(${direction * -100}%)` : "translateX(0)";
  }
  // 新圖片：一開始藏在換頁方向那一側的畫面外，進場旗標打開後滑回原地。
  return entered ? "translateX(0)" : `translateX(${direction * 100}%)`;
}
