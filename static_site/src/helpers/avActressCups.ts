import type { ActressSearchRequest } from "@/apis/av/actress_search.ts";

/** 把一串罩杯字（可含逗號）整理成大寫、去重複的陣列 */
export function normalizeCups(values: Array<string | undefined>) {
  const cups = values
    .flatMap((v) => (v ?? "").split(","))
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  return [...new Set(cups)];
}

/** 目前選到的罩杯：合併 cup（單選）與 cups（複選） */
export function selectedCups(req: Pick<ActressSearchRequest, "cup" | "cups">) {
  return normalizeCups([req.cup, req.cups]);
}

/** 依選到的罩杯數決定寫法：一個用 cup=A，多個用 cups=A,B,D，沒選就兩個都拿掉 */
export function withCups<T extends ActressSearchRequest>(
  req: T,
  cups: string[],
): T {
  const next = { ...req };
  delete next.cup;
  delete next.cups;
  if (cups.length === 1) next.cup = cups[0];
  if (cups.length > 1) next.cups = cups.join(",");
  return next;
}
