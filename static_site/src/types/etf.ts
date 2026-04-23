export interface EtfInfo {
  code: string;
  description: string;
  distributions: EtfDistribution[];
  divided_info?: EtfDivideInfo
}

export interface EtfDivideInfo {
  date: string; // 分割/反分割生效日
  ratio: number; // 分割比率：比如 0.2 代表 5 股合 1 ， 10 代表 1 股切割為 10 股
}

export interface EtfDistribution {
  per_share: number;
  declared_date: string;
  ex_date: string;
  payable_date: string;
  roc: number;
}
