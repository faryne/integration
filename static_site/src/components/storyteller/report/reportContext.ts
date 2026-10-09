import { createContext, useContext } from "react";
import type { ReportTarget } from "@/types/storytellerReport.ts";

// 全站共用的檢舉入口：各處只呼叫 openReport，登入提示、dialog、snack 由 ReportProvider 統一處理。
export const ReportContext = createContext<(target: ReportTarget) => void>(
  () => {},
);

export function useOpenReport() {
  return useContext(ReportContext);
}
