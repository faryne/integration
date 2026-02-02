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
