import { useEffect, useState } from "react";
import type { Transaction } from "@/components/etf/etf_profit_calculator_types.ts";

// YieldMax 沒有登入機制，交易紀錄（庫存資訊）直接存在瀏覽器 localStorage，不上傳後端
function storageKey(code: string) {
  return `faryne.yieldmax.transactions.${code}`;
}

function readTransactions(code: string): Transaction[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(storageKey(code));
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as Transaction[];
    // 舊格式資料 sells 可能是 null/undefined，防呆避免計算引擎 .map/.filter 白屏
    return parsed.map((t) => ({ ...t, sells: t.sells ?? [] }));
  } catch {
    return [];
  }
}

function writeTransactions(code: string, records: Transaction[]) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(storageKey(code), JSON.stringify(records));
}

export function useYieldMaxSavedTransactions(code: string) {
  const [records, setRecords] = useState<Transaction[]>(() =>
    readTransactions(code),
  );

  // 切換 ETF 代號時要重新載入該代號自己的紀錄
  useEffect(() => {
    setRecords(readTransactions(code));
  }, [code]);

  const save = (next: Transaction[]) => {
    writeTransactions(code, next);
    setRecords(next);
  };

  return { records, save };
}
