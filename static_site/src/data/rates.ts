import type { BankName } from "@/types/rates.ts";

export const BankMappings: Record<BankName, string> = {
  Mega: "兆豐銀行",
  BOT: "台灣銀行",
  esun: "玉山銀行",
  cathay: "國泰世華銀行",
  land: "土地銀行",
};

export const BankVisualMappings: Record<
  BankName,
  { mark: string; color: string }
> = {
  Mega: { mark: "兆", color: "#0b5cab" },
  BOT: { mark: "臺", color: "#b91c1c" },
  esun: { mark: "玉", color: "#0f766e" },
  cathay: { mark: "國", color: "#00843d" },
  land: { mark: "土", color: "#8a6f2a" },
};

export const CurrencyFlagMappings: Record<string, string> = {
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
  DKK: "🇩🇰",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  HKD: "🇭🇰",
  IDR: "🇮🇩",
  JPY: "🇯🇵",
  KRW: "🇰🇷",
  MYR: "🇲🇾",
  NOK: "🇳🇴",
  NZD: "🇳🇿",
  PHP: "🇵🇭",
  RMB: "🇨🇳",
  SEK: "🇸🇪",
  SGD: "🇸🇬",
  THB: "🇹🇭",
  TWD: "🇹🇼",
  USD: "🇺🇸",
  VND: "🇻🇳",
  ZAR: "🇿🇦",
};

export const getCurrencyFlag = (currency: string) =>
  CurrencyFlagMappings[currency.toUpperCase()] ?? "🌐";
