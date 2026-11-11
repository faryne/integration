import { AdSlot } from "@/components/common/promo/AdSlot.tsx";
import {
  JOYU_AD_PLACEMENTS,
  type JoyuAdPlacement,
} from "@/data/joyuAdUnits.ts";
import { isJoyuSite } from "@/helpers/joyu.ts";

import { useActressTopicHouse } from "./actressTopicSource.ts";
import { joyuSlotProvider } from "./slotProvider.ts";

/**
 * joyu 的版位：外部廣告（設定在 data/joyuAdUnits.ts），被擋或沒設定時改放女優主題推廣（之後加影片主題來源）。
 * 只在 joyu.fyi 出現，faryne.dev 的 /av 頁面共用同一份元件時不顯示。
 * placement 決定掛哪組廣告，也用它的順序錯開同一頁各格的推廣內容
 */
export function JoyuAdSlot({ placement }: { placement: JoyuAdPlacement }) {
  if (!isJoyuSite()) return null;
  return (
    <AdSlot
      provider={joyuSlotProvider(placement)}
      slot={JOYU_AD_PLACEMENTS.indexOf(placement)}
      useHouse={useActressTopicHouse}
    />
  );
}
