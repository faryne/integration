import { useState } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box } from "@mui/material";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import { isMissingActressPhoto } from "@/helpers/avActressDisplay.ts";

/**
 * 女優照片：沒有照片、xcity 的 noimage 或載入失敗時，顯示 3:4 的人像佔位圖，不出現破圖。
 * 女優頁、搜尋卡片、上稿表單預覽、審核頁共用
 */
export function ActressPhoto({
  src,
  alt,
  loading,
  sx,
}: {
  src?: string | null;
  alt: string;
  loading?: "lazy" | "eager";
  sx?: SxProps<Theme>;
}) {
  // 換照片網址時（例如上稿表單輸入中）重設失敗狀態
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (isMissingActressPhoto(src) || failedSrc === src) {
    return (
      <Box
        aria-label={alt}
        role="img"
        sx={[
          {
            alignItems: "center",
            aspectRatio: "3 / 4",
            bgcolor: "action.hover",
            color: "text.disabled",
            display: "flex",
            justifyContent: "center",
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <PersonOutlineIcon sx={{ fontSize: 56 }} />
      </Box>
    );
  }
  return (
    <Box
      alt={alt}
      component="img"
      loading={loading}
      onError={() => setFailedSrc(src ?? null)}
      src={src ?? undefined}
      sx={[
        { display: "block", objectFit: "cover" },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    />
  );
}
