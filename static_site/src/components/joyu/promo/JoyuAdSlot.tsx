import { AdSlot } from "@/components/common/promo/AdSlot.tsx";
import { isJoyuSite } from "@/helpers/joyu.ts";

import { useActressTopicHouse } from "./actressTopicSource.ts";
import { joyuSlotProvider } from "./slotProvider.ts";

/**
 * joyu 的版位：外部廣告（slotProvider.ts），被擋時改放女優主題推廣（之後加影片主題來源）。
 * 只在 joyu.fyi 出現，faryne.dev 的 /av 頁面共用同一份元件時不顯示。slot：同一頁第幾個版位
 */
export function JoyuAdSlot({ slot }: { slot?: number }) {
  if (!isJoyuSite()) return null;
  return (
    <AdSlot
      provider={joyuSlotProvider}
      slot={slot}
      useHouse={useActressTopicHouse}
    />
  );
}
