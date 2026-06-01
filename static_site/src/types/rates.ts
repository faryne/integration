export type BankName = "Mega" | "BOT" | "esun" | "cathay" | "land";

export interface Rate {
  service_name: BankName;
  base: string;
  to: string;
  buy_rate: number;
  sell_rate: number;
  record_date: string;
}
