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

export type TwStatRawData = {
  Name: string;
  Unit: string;
  Explain: string;
  ByYear: number;
  Total: string;
} & { [key in TWArea]: string };
