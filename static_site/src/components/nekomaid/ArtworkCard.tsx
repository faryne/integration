import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";
import {
  artworkPath,
  artworkPhotoCount,
  isAnimatedArtwork,
  isR18Artwork,
  itemSite,
  siteLabels,
  useR18Confirmed,
} from "@/helpers/nekomaid.ts";

export function ArtworkCard({
  item,
  forceBlur = false,
  sx,
}: {
  item: NekomaidArtwork;
  forceBlur?: boolean;
  sx?: SxProps<Theme>;
}) {
  const thumb = item.thumb || item.photos?.[0]?.url;
  const site = itemSite(item);
  const r18Confirmed = useR18Confirmed();
  const isR18 = !r18Confirmed && (forceBlur || isR18Artwork(item));
  const isAnimated = isAnimatedArtwork(item);
  const photoCount = artworkPhotoCount(item);

  return (
    <Paper
      component={RouterLink}
      to={artworkPath(item)}
      variant="outlined"
      sx={{
        bgcolor: "background.paper",
        borderRadius: 2,
        color: "inherit",
        display: "block",
        overflow: "hidden",
        textDecoration: "none",
        transition: "transform 160ms ease, box-shadow 160ms ease",
        "&:hover": {
          boxShadow: "0 16px 38px rgba(15, 23, 42, 0.16)",
          transform: "translateY(-3px)",
        },
        ...sx,
      }}
    >
      <Box
        sx={{
          alignItems: "center",
          bgcolor: "#f3f4f6",
          display: "flex",
          justifyContent: "center",
          minHeight: 174,
          overflow: "hidden",
          p: 1.75,
          position: "relative",
        }}
      >
        {thumb && (
          <Box
            sx={{
              alignItems: "center",
              bgcolor: "#fff",
              borderRadius: 0.75,
              boxShadow: "0 8px 24px rgba(15, 23, 42, 0.10)",
              display: "flex",
              justifyContent: "center",
              minHeight: 120,
              minWidth: 88,
              overflow: "hidden",
              p: 0.5,
              position: "relative",
            }}
          >
            <Box
              component="img"
              src={thumb}
              alt={item.title}
              loading="lazy"
              sx={{
                display: "block",
                filter: isR18 ? "blur(10px)" : "none",
                height: "auto",
                maxHeight: 140,
                maxWidth: 120,
                objectFit: "contain",
                transform: isR18 ? "scale(1.04)" : "none",
                width: "auto",
              }}
            />
            {isR18 && (
              <Box
                sx={{
                  alignItems: "center",
                  bgcolor: "rgba(17, 24, 39, 0.54)",
                  color: "#fff",
                  display: "flex",
                  fontSize: 12,
                  fontWeight: 900,
                  inset: 0,
                  justifyContent: "center",
                  letterSpacing: 0.8,
                  position: "absolute",
                }}
              >
                R18
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Stack spacing={1} sx={{ p: 1.5 }}>
        <Typography fontWeight={800} noWrap title={item.title}>
          {item.title || "未命名作品"}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={siteLabels[site] ?? site} size="small" />
          {photoCount > 1 && (
            <Chip
              label={`漫畫（共${photoCount}張）`}
              size="small"
              variant="outlined"
            />
          )}
          {isAnimated && (
            <Chip
              label="動圖"
              color="secondary"
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}
