import StarIcon from "@mui/icons-material/Star";
import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import {
  useGalgameBrands,
  useGalgameFavoriteStatus,
} from "@/apis/galgame/catalog.ts";
import { GalgamePageHeader } from "@/components/galgame/GalgamePageHeader.tsx";
import { GalgamePagination } from "@/components/galgame/GalgamePagination.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";
import { useGalgamePage } from "@/helpers/galgameTimeFilter.ts";
import { useTitle } from "@/helpers/title.tsx";

const perPage = 24;

/** 品牌列表頁（原首頁「品牌列表」分頁獨立出來）：頭像卡片＋分頁，已收藏的品牌標星號 */
export default function GalgameBrands() {
  const { t } = useTranslation();
  const { page } = useGalgamePage();
  const brands = useGalgameBrands("", page, perPage);
  const favoriteStatus = useGalgameFavoriteStatus(
    brands.data?.data.map((brand) => brand.id) ?? [],
    [],
  );
  const favoriteBrandIDs = new Set(favoriteStatus.data?.brand_ids ?? []);
  useTitle(t("galgame.brands.pageTitle"));

  return (
    <Stack sx={{ pb: 6 }}>
      <GalgamePageHeader
        current={t("galgame.brands.heading")}
        title={t("galgame.brands.heading")}
      />
      {brands.isPending ? (
        <GalgameState loading message={t("galgame.brands.loading")} />
      ) : brands.isError ? (
        <GalgameState severity="error" message={t("galgame.brands.error")} />
      ) : brands.data.data.length === 0 ? (
        <GalgameState message={t("galgame.brands.empty")} />
      ) : (
        <Grid container spacing={2.5}>
          {brands.data.data.map((brand) => (
            <Grid key={brand.public_id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardActionArea
                  component={RouterLink}
                  to={galgamePath(
                    galgameBrandSlug(brand.public_id, brand.name),
                  )}
                  sx={{ height: "100%" }}
                >
                  <CardContent>
                    <Stack alignItems="center" spacing={1.5}>
                      <Avatar
                        src={brand.avatar_url}
                        alt={brand.name}
                        sx={{ width: 96, height: 96 }}
                      />
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          maxWidth: 1,
                        }}
                      >
                        <Typography fontWeight={700} noWrap>
                          {brand.name}
                        </Typography>
                        {favoriteBrandIDs.has(brand.id) && (
                          <StarIcon
                            color="warning"
                            fontSize="small"
                            aria-label={t("galgame.brands.favorited")}
                          />
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      <GalgamePagination
        total={brands.data?.total ?? 0}
        perPage={brands.data?.per_page || perPage}
      />
    </Stack>
  );
}
