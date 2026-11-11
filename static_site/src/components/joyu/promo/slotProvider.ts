import type { AdProvider, PromoSize } from "@/components/common/promo/types.ts";
import { PROMO_SIZES } from "@/components/common/promo/types.ts";

// joyu 版位的外部廣告來源（目前預計接 adultforce）：換廣告商時只改這支，檔名與版位元件都不用動。
// 檔名刻意不帶 ad／廠商名稱：之後若拆成獨立 chunk，網址含 ad 字樣容易被 adblock 從網路層擋掉。
// 各尺寸的嵌入網址（iframe src）在 .env 設定；沒設定的尺寸不載廣告、直接放站內推廣。
// TODO：拿到實際嵌入碼後，若是 script 插入而不是 iframe，改寫 load 即可
const FRAME_SRC: Record<PromoSize, string | undefined> = {
  desktop: import.meta.env.VITE_JOYU_AD_FRAME_DESKTOP,
  mobile: import.meta.env.VITE_JOYU_AD_FRAME_MOBILE,
};

/**
 * 本機開發預設不載真廣告（直接看站內推廣），要測真廣告時設 VITE_JOYU_ADS=1；
 * 兩個尺寸都沒設定時也不載
 */
const enabled =
  (!import.meta.env.DEV || import.meta.env.VITE_JOYU_ADS === "1") &&
  Object.values(FRAME_SRC).some(Boolean);

export const joyuSlotProvider: AdProvider | undefined = enabled
  ? {
      async load(container, size) {
        const src = FRAME_SRC[size];
        if (!src) throw new Error("no zone");
        // 先用 no-cors 探一下：被 adblock 從網路層擋掉時 fetch 會直接 reject（iframe 被擋不會觸發 onerror）
        await fetch(src, { mode: "no-cors", cache: "no-store" });
        const { width, height } = PROMO_SIZES[size];
        const frame = Object.assign(document.createElement("iframe"), {
          src,
          width: String(width),
          height: String(height),
          scrolling: "no",
          loading: "lazy",
        });
        frame.style.border = "0";
        container.replaceChildren(frame);
      },
    }
  : undefined;
