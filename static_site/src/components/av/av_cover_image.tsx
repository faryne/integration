import { useState } from "react";
import type { SxProps, Theme } from "@mui/material";
import { Box } from "@mui/material";
import { AV_COVER_ASPECT_RATIO } from "@/data/avVideoCover.ts";
import {
  AV_COVER_LOW_RES_WIDTH,
  avPackageLargeUrl,
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
 * 以 src 當 key 包一層，換到別部影片時狀態會重置
 */
export function AvCoverImage(props: AvCoverImageProps) {
  return <CoverImage key={props.src} {...props} />;
}

function CoverImage({ src, alt, loading, sx }: AvCoverImageProps) {
  const large = avPackageLargeUrl(src);
  const [useLarge, setUseLarge] = useState(!!large && isAvTinyThumb(src));
  const [largeFailed, setLargeFailed] = useState(false);
  const showLarge = !!large && useLarge && !largeFailed;

  return (
    <Box
      component="img"
      src={showLarge ? large : src}
      alt={alt}
      loading={loading}
      onLoad={(e) => {
        if (
          !showLarge &&
          large &&
          e.currentTarget.naturalWidth < AV_COVER_LOW_RES_WIDTH
        ) {
          setUseLarge(true);
        }
      }}
      onError={() => {
        if (showLarge) setLargeFailed(true);
      }}
      sx={[
        ...(Array.isArray(sx) ? sx : [sx]),
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
