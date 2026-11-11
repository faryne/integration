import type { AdProvider } from "@/components/common/promo/types.ts";
import { unitsProvider } from "@/components/common/promo/units.ts";
import {
  JOYU_AD_PLACEMENTS,
  JOYU_ADS_ENABLED,
  type JoyuAdPlacement,
  joyuAdUnitsOf,
} from "@/data/joyuAdUnits.ts";

// joyu 各版位的外部廣告來源：設定在 data/joyuAdUnits.ts，這支只負責開關判斷。
// 檔名刻意不帶 ad／廠商名稱：之後若拆成獨立 chunk，網址含 ad 字樣容易被 adblock 從網路層擋掉

/** 本機開發預設不載真廣告（直接看站內推廣），要測真廣告時設 VITE_JOYU_ADS=1 */
const enabled =
  JOYU_ADS_ENABLED &&
  (!import.meta.env.DEV || import.meta.env.VITE_JOYU_ADS === "1");

// 每個版位的 provider 只建一次；沒有可用的廣告單元時是 undefined，版位直接放站內推廣
const PROVIDERS = Object.fromEntries(
  JOYU_AD_PLACEMENTS.map((p) => [
    p,
    enabled ? unitsProvider(joyuAdUnitsOf(p)) : undefined,
  ]),
) as Record<JoyuAdPlacement, AdProvider | undefined>;

export const joyuSlotProvider = (p: JoyuAdPlacement) => PROVIDERS[p];
