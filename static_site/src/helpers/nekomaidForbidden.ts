import { nekomaidPath } from "@/helpers/nekomaid.ts";
import type {
  CopyrightClaimStatus,
  NekomaidForbiddenSource,
} from "@/types/nekomaidForbidden.ts";

// neko.maid.tw 禁抓名單與版權申告共用的路徑、標籤與網址解析

/** 公開的處理結果頁；給 hash 時是同一 IP 送出的申告 */
export const copyrightClaimPath = (hash = "") =>
  nekomaidPath(hash ? `copyright-claim/${hash}` : "copyright-claim");

export const FORBIDDEN_SOURCE_LABEL: Record<NekomaidForbiddenSource, string> = {
  admin: "後台",
  submission: "版權申告",
  legacy: "舊資料",
};

export const CLAIM_STATUS_LABEL: Record<CopyrightClaimStatus, string> = {
  pending: "審核中",
  approved: "已核准",
  rejected: "已駁回",
};

export const CLAIM_STATUS_COLOR = {
  pending: "warning",
  approved: "success",
  rejected: "error",
} as const;

/** 本站作品／畫師頁的路徑；作品 ID 空字串時是畫師頁 */
export const nekomaidTargetPath = (
  site: string,
  authorId: string,
  artworkId = "",
) => nekomaidPath([site, authorId, artworkId].filter(Boolean).join("/"));

// 貼網址時自動帶入站台與 ID：本站網址三段都有；來源站的作品網址只有作品 ID，畫師由後端反查
const TARGET_URL_RULES: [
  RegExp,
  (m: RegExpMatchArray) => [string, string, string],
][] = [
  [
    /(?:neko\.maid\.tw|\/nekomaid)\/(pixiv|nico|tinami)\/([\w-]+)(?:\/([\w-]+))?/,
    (m) => [m[1], m[2], m[3] ?? ""],
  ],
  [/pixiv\.net\/(?:\w+\/)?users\/(\d+)/, (m) => ["pixiv", m[1], ""]],
  [/pixiv\.net\/(?:\w+\/)?artworks\/(\d+)/, (m) => ["pixiv", "", m[1]]],
  [/seiga\.nicovideo\.jp\/user\/illust\/(\d+)/, (m) => ["nico", m[1], ""]],
  [/seiga\.nicovideo\.jp\/seiga\/(im\d+)/, (m) => ["nico", "", m[1]]],
  [/tinami\.com\/creator\/profile\/(\d+)/, (m) => ["tinami", m[1], ""]],
  [/tinami\.com\/view\/(\d+)/, (m) => ["tinami", "", m[1]]],
];

/** 解析畫師／作品網址成 [站台, 畫師 ID, 作品 ID]；認不得回 null */
export function parseNekomaidTargetUrl(raw: string) {
  for (const [pattern, pick] of TARGET_URL_RULES) {
    const match = raw.match(pattern);
    if (match) return pick(match);
  }
  return null;
}
