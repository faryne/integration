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
  maker_no?: string;
  // 發售日（廠商發行日）；vod_date 是配信日，兩者常常不同
  publish_date?: string;
  // 片長（分鐘）
  duration?: number;
  tags: string[];
  images: {
    preview: string;
    thumb: string;
  }[];
}

export interface Actress {
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
}
