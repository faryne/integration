import { Box, IconButton, Stack, Typography } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import { useEffect, useState } from "react";
import type { NekomaidArtwork } from "@/types/nekomaid.ts";
import { itemSite } from "@/helpers/nekomaid.ts";
import { ArtworkCard } from "./ArtworkCard.tsx";

export function CompactRecommendations({
  items,
  forceBlur = false,
}: {
  items: NekomaidArtwork[];
  forceBlur?: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageSize = 3;
  const pageCount = Math.ceil(items.length / pageSize);
  const visibleItems = items.slice(page * pageSize, page * pageSize + pageSize);
  const canGoPrev = page > 0;
  const canGoNext = page < pageCount - 1;

  useEffect(() => {
    setPage(0);
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <Box>
      <Typography fontWeight={900} variant="h6" sx={{ mb: 1.5 }}>
        其他相關作品（{items.length} 張）
      </Typography>
      <Box
        sx={{
          display: { xs: "flex", sm: "none" },
          gap: 1.5,
          WebkitOverflowScrolling: "touch",
          mx: -0.5,
          overflowX: "auto",
          pb: 1,
          px: 0.5,
          scrollPaddingInline: 8,
          scrollSnapType: "x mandatory",
        }}
      >
        {items.map((item) => (
          <ArtworkCard
            key={`${itemSite(item)}-${item.author_id}-${item.artwork_id}`}
            item={item}
            forceBlur={forceBlur}
            sx={{
              flex: "0 0 72%",
              maxWidth: 260,
              scrollSnapAlign: "start",
            }}
          />
        ))}
      </Box>

      <Box
        sx={{
          display: { xs: "none", sm: "grid" },
          gap: 1.5,
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {visibleItems.map((item) => (
          <ArtworkCard
            key={`${itemSite(item)}-${item.author_id}-${item.artwork_id}`}
            item={item}
            forceBlur={forceBlur}
          />
        ))}
      </Box>
      {pageCount > 1 && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          spacing={1}
          sx={{ display: { xs: "none", sm: "flex" }, mt: 1.5 }}
        >
          <IconButton
            aria-label="上一批相關作品"
            disabled={!canGoPrev}
            onClick={() => setPage((current) => Math.max(current - 1, 0))}
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              height: 30,
              width: 30,
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 15 }} />
          </IconButton>
          {Array.from({ length: pageCount }).map((_, index) => (
            <Box
              component="button"
              key={index}
              type="button"
              aria-label={`切換到第 ${index + 1} 批相關作品`}
              onClick={() => setPage(index)}
              sx={{
                bgcolor: page === index ? "#111827" : "#e5e7eb",
                border: 0,
                borderRadius: "999px",
                cursor: "pointer",
                height: 9,
                p: 0,
                transition: "background-color 160ms ease, transform 160ms ease",
                width: 9,
                "&:hover": {
                  bgcolor: page === index ? "#111827" : "#cbd5e1",
                  transform: "scale(1.18)",
                },
              }}
            />
          ))}
          <IconButton
            aria-label="下一批相關作品"
            disabled={!canGoNext}
            onClick={() =>
              setPage((current) => Math.min(current + 1, pageCount - 1))
            }
            size="small"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              height: 30,
              width: 30,
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}
