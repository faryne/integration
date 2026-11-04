import { isGalgameSite } from "@/helpers/galgame.ts";

// 整合後台（faryne.dev/backend_admin）的路徑：後台內所有連結一律從這裡組
export const BACKEND_ADMIN_PATH = "/backend_admin";

// AV 女優上稿審核
export const avAdminSubmissionsPath = `${BACKEND_ADMIN_PATH}/av/submissions`;
export const avAdminSubmissionPath = (id: number) =>
  `${avAdminSubmissionsPath}/${id}`;
// AV 影片修改審核
export const avAdminVideoSubmissionsPath = `${BACKEND_ADMIN_PATH}/av/video-submissions`;
export const avAdminVideoSubmissionPath = (id: number) =>
  `${avAdminVideoSubmissionsPath}/${id}`;
export const avAdminTopicsPath = `${BACKEND_ADMIN_PATH}/av/topics`;
/** id 為 "new" 是新增 */
export const avAdminTopicPath = (id: number | "new") =>
  `${avAdminTopicsPath}/${id}`;

// neko.maid.tw 管理：禁抓名單、版權申告審核
export const nekomaidAdminPath = (page: "forbidden" | "claims") =>
  `${BACKEND_ADMIN_PATH}/nekomaid/${page}`;

// galgame 管理：五個功能頁
export type GalgameAdminPage =
  | "brands"
  | "videos"
  | "brand-submissions"
  | "video-submissions"
  | "title-keywords";
export const galgameAdminPath = (page: GalgameAdminPage) =>
  `${BACKEND_ADMIN_PATH}/galgame/${page}`;

/** galgame.tv 是另一個網域，從那邊進後台要連回主站（本機開發走 /galgame 巢狀模式，維持站內路徑） */
export const backendAdminUrl = (path: string) =>
  isGalgameSite() ? `https://faryne.dev${path}` : path;
