import { Link as RouterLink } from "react-router-dom";
import { Box, Typography } from "@mui/material";

import type { JoyuActressItem } from "@/apis/av/joyu.ts";
import { ActressPhoto } from "@/components/av/actress_photo.tsx";
import { joyuActressLink } from "@/helpers/joyuActressLink.ts";

/** 女優頁「共演女優」分頁的內容：依合作作品數排序；沒有共演（全是單體作品）時不顯示（分頁也不會出現） */
export function ActressCoStars({ items }: { items?: JoyuActressItem[] }) {
  if (!items?.length) return null;
  return (
    <Box component="section" sx={{ textAlign: "left" }}>
      <Typography color="text.secondary" sx={{ fontSize: 13, mb: 1.5 }}>
        依合作作品數
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 1.75,
          gridTemplateColumns: {
            xs: "repeat(3, minmax(0, 1fr))",
            sm: "repeat(4, minmax(0, 1fr))",
            md: "repeat(6, minmax(0, 1fr))",
          },
        }}
      >
        {items.map((item) => (
          <Box
            key={item.name}
            component={RouterLink}
            to={joyuActressLink(item)}
            sx={{
              color: "inherit",
              textAlign: "center",
              textDecoration: "none",
            }}
          >
            <ActressPhoto
              src={item.actress?.photo}
              alt={item.name}
              loading="lazy"
              sx={{
                width: "100%",
                aspectRatio: "1",
                borderRadius: "50%",
                objectPosition: "top",
              }}
            />
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, mt: 0.75 }}>
              {item.name}
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 12 }}>
              {item.count} 部
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
