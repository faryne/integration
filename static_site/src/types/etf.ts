export interface EtfInfo {
  code: string;
  description: string;
  distributions: EtfDistribution[];
  divided_info?: EtfDivideInfo[];
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

export interface TwseEtfInfo {
  date?: string;
  code: string;
  name: string;
  company?: string;
  target?: string;
  market?: string;
  ex_date?: string;
  share?: number;
  total_ex_count: number;
  success_fill_count: number;
  win_rate: number;
  avg_fill_days: number;
  range_position: number;
  latest_close: number;
  ma5: number;
  ma20: number;
  ma20_bias_rate: number;
}

export interface TwseEtfShare extends TwseEtfInfo {
  // 用於即將除息
  code: string;
  ex_date: string;
  name: string;
  share: number;
  pre_ex_close_price: number;
  yield_rate: number;
  filled_date: string;
  filled_close_price: number;
  filled_days: number;
  filled_trade_days: number;
  payable_date: string;
  distribution: number;
}

export interface TwseEtfShareDetail {
  // 用於主列表
  stats: TwseEtfShare[];
  win_rate: {
    total_ex_count: number;
    success_fill_count: number;
    win_rate: number;
    avg_fill_days: number;
  };
}

export interface TwseETFTicker {
  date: string;
  open: number;
  max: number;
  min: number;
  close: number;
  range_position_20: number;
  range_position_60: number;
  range_position_120: number;
  ma5: number;
  ma20: number;
  ma60: number;
  ma120: number;
  volume: number;
  trading_money: number;
  trading_turnover: number;
}
