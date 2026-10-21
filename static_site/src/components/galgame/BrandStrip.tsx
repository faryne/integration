import { Avatar, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";

import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import type { GalgameBrand } from "@/types/galgame.ts";

/** 品牌橫列：頭像＋名稱（＋可選的小字說明），可橫向捲動；首頁近期品牌與搜尋結果共用 */
export function BrandStrip({
  brands,
  caption,
}: {
  brands: GalgameBrand[];
  caption?: (brand: GalgameBrand) => string;
}) {
  return (
    <Stack
      direction="row"
      spacing={2.5}
      sx={{ overflowX: "auto", pb: 1, scrollbarWidth: "none" }}
    >
      {brands.map((brand) => (
        <Stack
          key={brand.public_id}
          component={RouterLink}
          to={galgamePath(galgameBrandSlug(brand.public_id, brand.name))}
          alignItems="center"
          spacing={0.75}
          sx={{
            width: 88,
            flexShrink: 0,
            color: "inherit",
            textDecoration: "none",
            textAlign: "center",
            "&:hover .MuiAvatar-root": { borderColor: "primary.main" },
          }}
        >
          <Avatar
            src={brand.avatar_url}
            alt={brand.name}
            sx={{ width: 72, height: 72, border: 2, borderColor: "divider" }}
          />
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ maxWidth: 1 }}
          >
            {brand.name}
          </Typography>
          {caption && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {caption(brand)}
            </Typography>
          )}
        </Stack>
      ))}
    </Stack>
  );
}
