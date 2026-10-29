// 指標分類：tw-stats 的 key 是主計總處「縣市重要統計指標」的流水號，同類指標編號相鄰，
// 因此直接用 key 區段分類，不必逐一標註。區段為閉區間，同一類可有多段。
export type TwStatsCategory = {
  id: string;
  label: string;
  ranges: Array<[number, number]>;
};

export const twStatsCategories: TwStatsCategory[] = [
  { id: "land", label: "土地", ranges: [[-1, 5]] },
  { id: "population", label: "人口", ranges: [[6, 152]] },
  {
    id: "labor",
    label: "勞動就業",
    ranges: [
      [153, 176],
      [476, 483],
      [630, 631],
    ],
  },
  {
    id: "civil",
    label: "公教與戶政",
    ranges: [
      [177, 185],
      [599, 604],
    ],
  },
  { id: "security", label: "治安", ranges: [[186, 216]] },
  { id: "safety", label: "交通事故與消防", ranges: [[217, 241]] },
  { id: "welfare", label: "社會福利", ranges: [[242, 310]] },
  { id: "education", label: "教育文化", ranges: [[311, 356]] },
  { id: "agriculture", label: "農林漁牧", ranges: [[357, 409]] },
  { id: "urban", label: "都市與交通", ranges: [[410, 455]] },
  { id: "business", label: "工商觀光", ranges: [[456, 475]] },
  { id: "finance", label: "財政", ranges: [[484, 541]] },
  { id: "health", label: "醫療衛生", ranges: [[542, 566]] },
  { id: "environment", label: "環境保護", ranges: [[567, 598]] },
  { id: "household", label: "家庭收支", ranges: [[605, 629]] },
];

// 落在所有區段之外的 key（未來新增指標）回傳 undefined，畫面上歸到「其他」
export const categoryOf = (key: string) => {
  const code = Number.parseInt(key, 10);
  return twStatsCategories.find((category) =>
    category.ranges.some(([from, to]) => code >= from && code <= to),
  )?.id;
};

export const isTwStatsCategory = (value: string | null) =>
  twStatsCategories.some((category) => category.id === value);
