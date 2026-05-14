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
}

export interface TwseEtfUpcomingShare {
  // 用於即將除息
  code: string;
  ex_date: string;
  name: string;
  dividend_amount: number;
  pre_ex_close_price: number;
  yield_rate: number;
  filled_date: string;
  filled_close_price: number;
  filled_days: number;
  filled_trade_days: number;
  payable_date: string;
  distribution: number;
}

export interface TwseEtfShare {
  // 用於主列表
  stats: TwseEtfUpcomingShare[];
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
}
