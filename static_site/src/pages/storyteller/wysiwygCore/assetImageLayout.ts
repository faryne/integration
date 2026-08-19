import type { SxProps, Theme } from "@mui/material/styles";

import {
  ASSET_IMAGE_LAYOUT_VALUES,
  ASSET_IMAGE_SIZE_VALUES,
  DEFAULT_ASSET_IMAGE_LAYOUT,
  DEFAULT_ASSET_IMAGE_SIZE,
  normalizeAssetImageLayout,
  normalizeAssetImageSize,
  type AssetImageLayoutValue,
  type AssetImageSizeValue,
} from "./whitelist";

export const ASSET_IMAGE_LAYOUT_LABELS: Record<
  AssetImageLayoutValue,
  string
> = {
  block: "圖片全寬",
  center: "圖片置中",
  "float-left": "圖片靠左環繞",
  "float-right": "圖片靠右環繞",
};

export const ASSET_IMAGE_LAYOUT_OPTIONS = ASSET_IMAGE_LAYOUT_VALUES.map(
  (value) => ({ value, label: ASSET_IMAGE_LAYOUT_LABELS[value] }),
);

export const ASSET_IMAGE_SIZE_LABELS: Record<AssetImageSizeValue, string> = {
  small: "小",
  medium: "中",
  large: "大（原尺寸比例）",
};

export const ASSET_IMAGE_SIZE_OPTIONS = ASSET_IMAGE_SIZE_VALUES.map(
  (value) => ({ value, label: ASSET_IMAGE_SIZE_LABELS[value] }),
);

/** 三種 layout 各自的 size 換算表——每種 layout 的「大」都維持原本（Phase 7 定案）
 * 的百分比，不是新加的，只是原本寫死的值現在對應到 large；small／medium 是新加的
 * 兩檔，用同一套視覺比例縮小，不是照統一比例硬乘（block 全寬縮小後如果只乘同一個
 * 比例，中/小尺寸會比 float 版面還寬，比例上不合理，所以三組各自訂一份數字）。
 *
 * 2026-08-17 拿掉原本 `min(百分比, px上限)` 裡的 px 上限，改成純百分比：編輯器
 * 內文欄寬（無上限，跟著視窗變化）常常遠寬於閱讀頁內文欄寬（~900px 上下），原本
 * 那組 px 上限剛好卡在閱讀頁的欄寬附近——這代表閱讀頁幾乎不受這個上限影響（百分比
 * 跟上限本來就接近），但編輯器欄寬只要超過臨界值（float 大約 800~900px、center
 * 800px），上限就會先卡住百分比，導致同一個 size 在編輯器跟閱讀頁呈現出完全不同
 * 的相對比例（使用者截圖比對發現，見已知 Bug 記錄第 10 項的後續討論）。拿掉上限
 * 後，兩邊都純粹照百分比算，比例才會一致；圖片本身的 <img> 還有 maxHeight 頂著
 * （見 assetImageNode.tsx／StorytellerWysiwygMarkdown.tsx），直式構圖的圖片寬度
 * 撐大後還是會先被高度上限跟 objectFit:contain 頂住縮回來，不會無限跟著容器變大。 */
const BLOCK_SIZE_WIDTH: Record<AssetImageSizeValue, string> = {
  small: "40%",
  medium: "70%",
  large: "100%",
};
const CENTER_SIZE_WIDTH: Record<AssetImageSizeValue, string> = {
  small: "40%",
  medium: "60%",
  large: "80%",
};
const FLOAT_SIZE_WIDTH: Record<AssetImageSizeValue, string> = {
  small: "25%",
  medium: "35%",
  large: "45%",
};

/** 組回圖片 markdown 語法的 title 字串——layout／size 各自等於預設值時省略那個
 * key，caption 為空也省略，全部都省略時整個 title 都不輸出，維持跟改動前一樣
 * 「預設值不留痕跡」的匯出風格，不會讓沒特別調過設定的舊圖片語法多長出一截。 */
export function assetImageTitle(
  layout: AssetImageLayoutValue,
  size: AssetImageSizeValue,
  caption = "",
) {
  const parts: string[] = [];
  if (layout !== DEFAULT_ASSET_IMAGE_LAYOUT) parts.push(`layout=${layout}`);
  if (size !== DEFAULT_ASSET_IMAGE_SIZE) parts.push(`size=${size}`);
  if (caption) parts.push(`caption=${encodeURIComponent(caption)}`);
  return parts.length > 0 ? ` "${parts.join(" ")}"` : "";
}

export function assetImageFrameSx(
  layoutValue: unknown,
  sizeValue: unknown,
): SxProps<Theme> {
  const layout = normalizeAssetImageLayout(layoutValue);
  const size = normalizeAssetImageSize(sizeValue);
  const base: SxProps<Theme> = {
    my: 1,
    maxWidth: "100%",
    overflow: "hidden",
    borderRadius: 1,
    bgcolor: "background.default",
  };
  if (layout === "center") {
    return {
      ...base,
      display: "block",
      // 手機斷點一律強制全寬（跟改動前一樣，Phase 7 已經驗證過的行為），size
      // 只影響桌面/平板寬度，避免窄螢幕上刻意縮小圖片反而更難看清楚。
      width: { xs: "100%", sm: CENTER_SIZE_WIDTH[size] },
      mx: "auto",
      clear: "both",
    };
  }
  if (layout === "float-left" || layout === "float-right") {
    const isLeft = layout === "float-left";
    return {
      ...base,
      display: "block",
      float: { xs: "none", sm: isLeft ? "left" : "right" },
      width: { xs: "100%", sm: FLOAT_SIZE_WIDTH[size] },
      mr: { xs: 0, sm: isLeft ? 2 : 0 },
      ml: { xs: 0, sm: isLeft ? 0 : 2 },
      clear: "both",
    };
  }
  const width = BLOCK_SIZE_WIDTH[size];
  return {
    ...base,
    display: "block",
    width: { xs: "100%", sm: width },
    // 縮小過的全寬圖片如果不置中，會貼齊左邊看起來像沒對齊——只有維持 100% 原本
    // 全寬時才不需要這個（mx:auto 對滿版寬度沒有視覺差異，但沒必要多套一次）。
    mx: width === "100%" ? 0 : "auto",
  };
}

export const CLEAR_FLOATING_ASSET_SX = {
  "& h1, & h2, & h3, & h4, & h5, & h6": { clear: "both" },
  "& [data-block-kind], & table, & [data-asset-layout]": { clear: "both" },
} as const;
