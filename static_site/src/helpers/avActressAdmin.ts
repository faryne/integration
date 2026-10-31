// 女優管理後台（/av/actress/admin）的路徑：上稿審核、女優主題都是後台的子頁，連結一律從這裡組
export const AV_ACTRESS_ADMIN_PATH = "/av/actress/admin";
export const avAdminSubmissionsPath = `${AV_ACTRESS_ADMIN_PATH}/submissions`;
export const avAdminSubmissionPath = (id: number) =>
  `${avAdminSubmissionsPath}/${id}`;
export const avAdminTopicsPath = `${AV_ACTRESS_ADMIN_PATH}/topics`;
/** id 為 "new" 是新增 */
export const avAdminTopicPath = (id: number | "new") =>
  `${avAdminTopicsPath}/${id}`;
