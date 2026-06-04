import { Box, Stack, Typography } from "@mui/material";
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
          display: "grid",
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
          justifyContent="center"
          spacing={1}
          sx={{ mt: 1.5 }}
        >
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
        </Stack>
      )}
    </Box>
  );
}
