import { useState } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box, Typography } from "@mui/material";
import ImageNotSupportedOutlinedIcon from "@mui/icons-material/ImageNotSupportedOutlined";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";
import {
  AV_COVER_LOW_RES_WIDTH,
  avPackageLargeUrl,
  isAvCoverPlaceholder,
  isAvTinyThumb,
} from "@/helpers/avCover.ts";

interface AvCoverImageProps {
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
  sx?: SxProps<Theme>;
}

/**
 * AV 封面：舊作低解析封面自動改用 pl.jpg 右側裁切（同一張封面、解析度高好幾倍）。
 * - pt.jpg：直接用 pl
 * - ps.jpg：照常載入，naturalWidth 太小才換成 pl；新作的高解析 ps 不受影響
 * - pl 載入失敗：退回原圖
 * - 沒有封面（網址是空的、DMM 回 NOW PRINTING 佔位圖、原圖也載入失敗）：不放 <img>，改顯示替代區塊
 * 以 src 當 key 包一層，換到別部影片時狀態會重置
 */
export function AvCoverImage(props: AvCoverImageProps) {
  if (!props.src) return <CoverFallback sx={props.sx} />;
  return <CoverImage key={props.src} {...props} />;
}

/** 沒有封面時的替代區塊：大小沿用呼叫端給的樣式，比例固定成封面比例 */
function CoverFallback({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Box
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        {
          alignItems: "center",
          aspectRatio: AV_COVER_ASPECT_RATIO,
          bgcolor: "action.hover",
          color: "text.disabled",
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          justifyContent: "center",
          width: "100%",
        },
      ]}
    >
      <ImageNotSupportedOutlinedIcon />
      <Typography sx={{ fontSize: 12 }}>尚無封面</Typography>
    </Box>
  );
}

function CoverImage({ src, alt, loading, sx }: AvCoverImageProps) {
  const large = avPackageLargeUrl(src);
  const [useLarge, setUseLarge] = useState(!!large && isAvTinyThumb(src));
  const [largeFailed, setLargeFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  // 載入完、確認不是佔位圖之前先隱藏，才不會閃一下 NOW PRINTING
  const [verified, setVerified] = useState(false);
  const showLarge = !!large && useLarge && !largeFailed;
  if (missing) return <CoverFallback sx={sx} />;

  return (
    <Box
      component="img"
      src={showLarge ? large : src}
      alt={alt}
      loading={loading}
      onLoad={(e) => {
        const img = e.currentTarget;
        // 佔位圖：換用的 pl 是佔位圖就退回原圖（原圖可能是小張但真的封面），原圖本身是佔位圖才算沒有封面
        if (isAvCoverPlaceholder(img)) {
          if (showLarge) setLargeFailed(true);
          else setMissing(true);
          return;
        }
        // pl 失敗過就不再換，否則退回原圖後又會想換 pl，圖片永遠停在隱藏
        if (
          !showLarge &&
          large &&
          !largeFailed &&
          img.naturalWidth < AV_COVER_LOW_RES_WIDTH
        ) {
          setUseLarge(true);
          return;
        }
        setVerified(true);
      }}
      onError={() => {
        if (showLarge) setLargeFailed(true);
        else setMissing(true);
      }}
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
        { opacity: verified ? 1 : 0 },
        // pl 是整片外盒，固定成封面比例並只顯示右側（封面所在的位置）
        showLarge && {
          aspectRatio: AV_COVER_ASPECT_RATIO,
          objectFit: "cover",
          objectPosition: "right center",
        },
      ]}
    />
  );
}
