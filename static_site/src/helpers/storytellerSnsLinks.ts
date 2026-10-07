// SNS 連結編輯共用的資料轉換：「我的檔案」與「額外筆名」對話框共用同一套列（row）模型。
// 可見性跟著「列」走，改類型或自訂名稱時不會掉；送出時才組成 sns_links＋sns_private_keys。

export const SNS_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "x", label: "X（Twitter）" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "threads", label: "Threads" },
  { value: "website", label: "個人網站" },
  { value: "plurk", label: "Plurk" },
  { value: "bahamut", label: "巴哈姆特" },
  { value: "discord", label: "Discord" },
  { value: "youtube", label: "YouTube" },
];

export const CUSTOM_SNS_TYPE = "__custom__";
const KNOWN_SNS_TYPES = new Set(SNS_TYPE_OPTIONS.map((option) => option.value));

// 跟後端 validateSNSLinks 的網域白名單一致，送出前先在前端提示
const SNS_DOMAIN_HINTS: Record<string, string[]> = {
  x: ["x.com", "twitter.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  threads: ["threads.net", "threads.com"],
  plurk: ["plurk.com"],
  bahamut: ["gamer.com.tw"],
  discord: ["discord.com", "discord.gg"],
  youtube: ["youtube.com", "youtu.be"],
};

export interface SNSLinkRow {
  id: string;
  type: string;
  customLabel: string;
  url: string;
  // isPrivate：只有自己看得到，公開作者頁、作品作者欄、追蹤清單都不會出現
  isPrivate: boolean;
}

export function snsUrlError(type: string, url: string): string | undefined {
  if (!url.trim()) return undefined;
  const domains = SNS_DOMAIN_HINTS[type];
  if (!domains) return undefined;
  const lower = url.toLowerCase();
  if (domains.some((domain) => lower.includes(domain))) return undefined;
  return `網址需包含 ${domains.join(" 或 ")}`;
}

export function hasSnsRowError(rows: SNSLinkRow[]) {
  return rows.some((row) => Boolean(snsUrlError(row.type, row.url)));
}

export function newSnsRow(): SNSLinkRow {
  return {
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "x",
    customLabel: "",
    url: "",
    isPrivate: false,
  };
}

export function snsRowsFromLinks(
  links: Record<string, string> | undefined,
  privateKeys: string[] | undefined,
): SNSLinkRow[] {
  const hidden = new Set(privateKeys ?? []);
  return Object.entries(links ?? {}).map(([key, url], index) => ({
    id: `${index}-${key}`,
    type: KNOWN_SNS_TYPES.has(key) ? key : CUSTOM_SNS_TYPE,
    customLabel: KNOWN_SNS_TYPES.has(key) ? "" : key,
    url,
    isPrivate: hidden.has(key),
  }));
}

// snsPayloadFromRows 空白列直接略過；同一個 key 出現多次時以最後一列為準（跟物件覆寫行為一致）
export function snsPayloadFromRows(rows: SNSLinkRow[]) {
  const links: Record<string, string> = {};
  const privateKeys = new Set<string>();
  for (const row of rows) {
    const key =
      row.type === CUSTOM_SNS_TYPE ? row.customLabel.trim() : row.type;
    const url = row.url.trim();
    if (!key || !url) continue;
    links[key] = url;
    if (row.isPrivate) privateKeys.add(key);
    else privateKeys.delete(key);
  }
  return { sns_links: links, sns_private_keys: [...privateKeys] };
}
