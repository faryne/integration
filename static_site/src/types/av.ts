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
