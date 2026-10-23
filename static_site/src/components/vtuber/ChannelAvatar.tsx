import { Avatar, type AvatarProps } from "@mui/material";

/**
 * YouTube 頻道頭像：yt3.ggpht.com 收到外站 referrer 會拒絕，一律不帶 referrer。
 * API 給的是 800px 大圖，改抓 176px（畫面上最大 84px 的兩倍），列表一次幾十張才不會慢。
 */
export function ChannelAvatar({ src, ...props }: AvatarProps) {
  return (
    <Avatar
      {...props}
      src={src?.replace(/=s\d+-/, "=s176-")}
      slotProps={{ img: { referrerPolicy: "no-referrer" } }}
    />
  );
}
