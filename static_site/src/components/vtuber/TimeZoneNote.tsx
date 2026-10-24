import { Typography } from "@mui/material";

/** 直播時間一律用台北時間顯示（format.ts 的 TIME_ZONE），在時間清單旁標出來，海外使用者才不會誤會 */
export function TimeZoneNote() {
  return (
    <Typography
      variant={"caption"}
      color={"text.disabled"}
      sx={{ whiteSpace: "nowrap" }}
    >
      台北時間（UTC+8）
    </Typography>
  );
}
