export interface Video {
  url: string;
  no: string;
  vod_date: string;
  thumb: string;
  title: string;
  labels: string[];
  makers: string[];
  directors: string[];
  series: string[];
  actresses: string[];
  // DMM 女優 ID，順序與 actresses 一致（空字串＝明細沒給）；2026-10-30 之前同步的舊影片是空陣列
  actress_ids?: string[];
  maker_no?: string;
  // 發售日（廠商發行日）；vod_date 是配信日，兩者常常不同
  publish_date?: string;
  // 片長（分鐘）
  duration?: number;
  // 同步資料確定失敗（DMM 已查無、沒有官方番號），不再顯示同步按鈕
  is_orphan?: boolean;
  tags: string[];
  images: {
    preview: string;
    thumb: string;
  }[];
}

/** 女優頁「連結」區塊的一筆參考連結；title 沒填時顯示網域 */
export interface ActressLink {
  title: string;
  url: string;
}

export interface Actress {
  // domain＋aid 指向資料庫那一筆，修改資料時用來指定要改哪位
  domain: string;
  aid: number;
  // 舊資料（xcity 同步）沒有這個欄位
  links?: ActressLink[] | null;
  blood: string;
  height: number;
  kana: string;
  bust: number;
  cup: string;
  birth_month: number;
  horoscope: string;
  name: string;
  photo: string;
  waist: number;
  born_city: string;
  birth_year: number;
  birth_day: number;
  hips: number;
  interests: string[];
  // 別名（不含本名）；舊文件沒有這個欄位
  aliases?: string[] | null;
}
