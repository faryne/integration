export type TWArea =
  | "Taiwan"
  | "NewTaipei"
  | "Taipei"
  | "Taoyuan"
  | "Taichung"
  | "Tainan"
  | "Kaohsiung"
  | "Ilan"
  | "HsinchuCounty"
  | "Miaoli"
  | "Changhwa"
  | "Nantou"
  | "Yunlin"
  | "ChiaYiCounty"
  | "Pingtung"
  | "Taitung"
  | "Hualien"
  | "Penghu"
  | "Keelung"
  | "HsinchuCity"
  | "ChiaYiCity"
  | "Kinmen"
  | "Matsu";

export const TWAreaMappings: { [key in TWArea]: string } = {
  Taiwan: "台灣",
  NewTaipei: "新北市",
  Taipei: "台北市",
  Taoyuan: "桃園市",
  Taichung: "台中市",
  Tainan: "台南市",
  Kaohsiung: "高雄市",
  Ilan: "宜蘭縣",
  HsinchuCounty: "新竹縣",
  Miaoli: "苗栗縣",
  Changhwa: "彰化縣",
  Nantou: "南投縣",
  Yunlin: "雲林縣",
  ChiaYiCounty: "嘉義縣",
  Pingtung: "屏東縣",
  Taitung: "臺東縣",
  Hualien: "花蓮縣",
  Penghu: "澎湖縣",
  Keelung: "基隆市",
  HsinchuCity: "新竹市",
  ChiaYiCity: "嘉義市",
  Kinmen: "金門縣",
  Matsu: "連江縣",
};

export type TwStatRawData = {
  Name: string;
  Unit: string;
  Explain: string;
  ByYear: number;
  Total: string;
} & { [key in TWArea]: string };

// 以下對應後端 /opendata/tw-stats 分析 API（model/entity/opendata/twstats）
export type TwStatsArea = { code: TWArea; name: string };

// per_capita：數量類指標，排名時以每萬人換算值比較
export type TwStatsIndicatorRef = {
  key: string;
  name: string;
  unit: string;
  category: string;
  per_capita: boolean;
};

export type TwStatsAreaIndicator = TwStatsIndicatorRef & {
  year: number;
  value: number;
  per_capita_value?: number;
  rank: number;
  rank_total: number;
  change_rate?: number;
};

export type TwStatsAreaProfile = {
  area: TwStatsArea;
  loaded_at: string;
  indicators: TwStatsAreaIndicator[];
};

export type TwStatsNationalMover = TwStatsIndicatorRef & {
  value: number;
  previous_value: number;
  change_rate: number;
};

// rank_change 正數＝名次往前
export type TwStatsCountyMover = TwStatsIndicatorRef & {
  area: TwStatsArea;
  value: number;
  per_capita_value?: number;
  rank: number;
  previous_rank: number;
  rank_change: number;
  change_rate?: number;
};

export type TwStatsMovers = {
  year: number;
  latest_year: number;
  national: TwStatsNationalMover[];
  counties: TwStatsCountyMover[];
};
