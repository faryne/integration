// 版位（外部廣告＋被擋時的站內推廣）共用型別：廣告商與推廣內容都由各站注入，版位元件本身不綁定任何站
//
// 注意：這個資料夾的元件不要加 ad／ads／banner／sponsor 之類的 class、id、data-* 名稱，
// adblock 的 cosmetic 規則（EasyList）會依名稱把元素藏起來，連站內推廣一起不見

/** 版位尺寸：PC 728×90、手機 300×100（IAB 標準尺寸） */
export type PromoSize = "desktop" | "mobile";

export const PROMO_SIZES: Record<PromoSize, { width: number; height: number }> =
  {
    desktop: { width: 728, height: 90 },
    mobile: { width: 300, height: 100 },
  };

/**
 * 外部廣告商：把廣告放進 container；被擋（網路層攔截、script 載入失敗）或沒設定時 reject。
 * resolve 之後版位還會再檢查一次 container 有沒有真的長出東西（cosmetic filter、沒填單）
 */
export interface AdProvider {
  load: (container: HTMLElement, size: PromoSize) => Promise<void>;
}

/** 站內推廣的一張卡片：kicker 小標、標題、數字補述、頭像、連結（站內路徑） */
export interface HousePromoItem {
  key: string;
  kicker: string;
  title: string;
  count?: string;
  faces: { src: string; alt: string }[];
  to: string;
  /** PC 版右側的引導字（例：看主題 →）；手機版放不下會隱藏 */
  cta: string;
}

/**
 * 站內推廣的內容來源（React hook）：回傳可輪播的卡片；undefined＝讀取中、空陣列＝沒有可用內容（讀取失敗也回空陣列）。
 * 同一頁可以合併多個來源（之後的影片主題）
 */
export type HouseSource = () => HousePromoItem[] | undefined;
