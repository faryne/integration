export type BankName = "Mega" | "BOT" | "esun" | "cathay" | "land";

export const BankMappings: { [key in BankName]: string } = {
  Mega: "兆豐銀行",
  BOT: "台灣銀行",
  esun: "玉山銀行",
  cathay: "國泰世華銀行",
  land: "土地銀行",
};

export interface Rate {
  service_name: BankName;
  base: string;
  to: string;
  buy_rate: number;
  sell_rate: number;
  record_date: string;
}
