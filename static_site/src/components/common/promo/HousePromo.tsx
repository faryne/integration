import { Link as RouterLink } from "react-router-dom";
import { Avatar, Box, Stack, Typography } from "@mui/material";

import type { HousePromoItem, PromoSize } from "./types.ts";

// 頭像數量與大小：PC 6 張 52px、手機 3 張 36px（300 寬放不下更多，也放不下引導字）
const FACES: Record<PromoSize, { n: number; px: number }> = {
  desktop: { n: 6, px: 52 },
  mobile: { n: 3, px: 36 },
};

/** 被擋掉的版位改放的站內推廣卡片：整格是連結，填滿版位的尺寸 */
export function HousePromo({
  item,
  size,
}: {
  item: HousePromoItem;
  size: PromoSize;
}) {
  const mobile = size === "mobile";
  const face = FACES[size];
  return (
    <Box
      component={RouterLink}
      sx={{
        alignItems: "center",
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 1.5,
        // padding 與邊框算在版位尺寸內（有的站沒有全域 border-box）
        boxSizing: "border-box",
        color: "text.primary",
        display: "flex",
        gap: mobile ? 1 : 1.5,
        height: "100%",
        px: mobile ? 1.5 : 2.5,
        textDecoration: "none",
        transition: "border-color 160ms",
        width: "100%",
        "&:hover": { borderColor: "primary.main" },
      }}
      to={item.to}
    >
      <Stack sx={{ flex: "1 1 auto", minWidth: 0, textAlign: "left" }}>
        <Typography sx={{ color: "text.secondary", fontSize: 11 }}>
          {item.kicker}
        </Typography>
        <Typography noWrap sx={{ fontSize: mobile ? 14 : 16, fontWeight: 800 }}>
          {item.title}
          {item.count && (
            <Box component="span" sx={{ color: "primary.main" }}>
              ・{item.count}
            </Box>
          )}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={mobile ? 0.5 : 0.75}>
        {item.faces.slice(0, face.n).map((f) => (
          <Avatar
            alt={f.alt}
            key={f.src}
            slotProps={{
              img: { loading: "lazy", style: { objectPosition: "top" } },
            }}
            src={f.src}
            sx={{
              border: 2,
              borderColor: "primary.main",
              height: face.px,
              width: face.px,
            }}
          />
        ))}
      </Stack>
      {!mobile && (
        <Typography
          sx={{ color: "primary.main", fontSize: 12, whiteSpace: "nowrap" }}
        >
          {item.cta}
        </Typography>
      )}
    </Box>
  );
}
