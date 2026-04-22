export interface EtfInfo {
  code: string;
  description: string;
  distributions: EtfDistribution[];
}

export interface EtfDistribution {
  per_share: number;
  declared_date: string;
  ex_date: string;
  payable_date: string;
  roc: number;
}
