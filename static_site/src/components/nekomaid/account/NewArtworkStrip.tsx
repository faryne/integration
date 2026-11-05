import { Link as RouterLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";

import {
  artworkPath,
  isR18Artwork,
  useR18Confirmed,
} from "@/helpers/nekomaid.ts";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";

/**
 * 我的追蹤 → 畫師 tab：「前一次登入～本次登入」之間新增的作品，沒有就顯示「無作品」。
 * 縮圖是抓取時產生的（最長邊 120px），照原尺寸顯示、不放大不裁切，排成一列、超出寬度可橫向捲動。
 * R18 作品在還沒確認年滿 18 歲前模糊處理（跟作品卡片一致）
 */
export function NewArtworkStrip({ artworks }: { artworks: NekomaidArtwork[] }) {
  const r18Confirmed = useR18Confirmed();
  if (artworks.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 1 }} variant="body2">
        無作品
      </Typography>
    );
  }
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        gap: 1,
        mt: 1.5,
        overflowX: "auto",
        pb: 0.5,
      }}
    >
      {artworks.map((artwork) => {
        const blur = !r18Confirmed && isR18Artwork(artwork);
        return (
          <Box
            component={RouterLink}
            key={artwork.artwork_id}
            sx={{
              alignItems: "center",
              bgcolor: "#f3f4f6",
              borderRadius: 1,
              display: "flex",
              flexShrink: 0,
              height: 136,
              justifyContent: "center",
              overflow: "hidden",
              width: 136,
            }}
            title={artwork.title}
            to={artworkPath(artwork)}
          >
            <Box
              alt={artwork.title}
              component="img"
              loading="lazy"
              src={artwork.thumb || artwork.photos?.[0]?.url}
              sx={{
                display: "block",
                filter: blur ? "blur(10px)" : "none",
                maxHeight: 120,
                maxWidth: 120,
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}
