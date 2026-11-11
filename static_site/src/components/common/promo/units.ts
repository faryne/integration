import { type AdProvider, PROMO_SIZES, type PromoSize } from "./types.ts";

/**
 * 一個外部廣告單元（某家廠商的某個 zone）：各尺寸各自的嵌入網址，沒填的尺寸就不在那個尺寸出現。
 * - iframe：src 直接當 iframe 網址
 * - script：在版位裡插 <script src>，attrs 會原樣加在 script 上（廠商要求的 data-zone 之類）。
 *   用 document.write 的舊式嵌入碼在 SPA 裡不能用，要跟廠商拿 async 版
 */
export interface AdUnit {
  /** 廠商名稱，只給人看（設定檔好讀、之後統計用） */
  vendor: string;
  type: "iframe" | "script";
  src: Partial<Record<PromoSize, string>>;
  attrs?: Record<string, string>;
  /** 同一個版位有多個單元時依權重隨機挑，預設 1 */
  weight?: number;
}

// 先用 no-cors 探一下：被 adblock 從網路層擋掉時 fetch 會直接 reject（iframe 被擋不會觸發 onerror）
const probe = (src: string) =>
  fetch(src, { mode: "no-cors", cache: "no-store" });

/** 各嵌入方式的載入方法；載入失敗（被擋）要 reject，版位會改放站內推廣 */
const LOADERS: Record<
  AdUnit["type"],
  (
    container: HTMLElement,
    src: string,
    unit: AdUnit,
    size: PromoSize,
  ) => Promise<void>
> = {
  async iframe(container, src, _unit, size) {
    await probe(src);
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
  script: (container, src, unit) =>
    new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement("script"), {
        async: true,
        src,
      });
      Object.entries(unit.attrs ?? {}).forEach(([k, v]) =>
        s.setAttribute(k, v),
      );
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("script blocked"));
      container.replaceChildren(s);
    }),
};

/** 依權重從有這個尺寸網址的單元裡挑一個 */
function pickUnit(units: AdUnit[], size: PromoSize) {
  const usable = units.filter((u) => u.src[size]);
  let r = Math.random() * usable.reduce((n, u) => n + (u.weight ?? 1), 0);
  return usable.find((u) => (r -= u.weight ?? 1) < 0);
}

/**
 * 把一組廣告單元包成版位用的 AdProvider；沒有任何單元時回傳 undefined（版位直接放站內推廣，不等 3 秒）。
 * 這個尺寸沒有可用單元時 reject，一樣改放站內推廣
 */
export function unitsProvider(units: AdUnit[]): AdProvider | undefined {
  if (!units.some((u) => Object.values(u.src).some(Boolean))) return undefined;
  return {
    async load(container, size) {
      const unit = pickUnit(units, size);
      if (!unit) throw new Error("no unit for size");
      await LOADERS[unit.type](container, unit.src[size]!, unit, size);
    },
  };
}
