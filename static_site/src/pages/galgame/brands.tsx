import {
  Avatar,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useMemo } from "react";

import { useGalgameBrands } from "@/apis/galgame/catalog.ts";
import { GalgameBreadcrumb } from "@/components/galgame/GalgameBreadcrumb.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";
import { galgameBrandSlug } from "@/helpers/galgame.ts";
import { useTitle } from "@/helpers/title.tsx";

export default function GalgameBrands() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const brands = useGalgameBrands("", page, 24);
  const sortedBrands = useMemo(() => {
    const collator = new Intl.Collator(["en", "ja", "zh-TW"], {
      numeric: true,
      sensitivity: "base",
    });
    return [...(brands.data?.data ?? [])].sort((left, right) =>
      collator.compare(left.name, right.name),
    );
  }, [brands.data?.data]);
  const pages = useMemo(
    () => Math.max(1, Math.ceil((brands.data?.total ?? 0) / (brands.data?.per_page || 24))),
    [brands.data],
  );
  useTitle("Galgame 品牌列表");

  return (
    <Box sx={{ pb: 6 }}>
      <GalgameBreadcrumb current="品牌列表" />
      <Stack spacing={3}>
        <Typography variant="h3" component="h1">品牌列表</Typography>
        {brands.isPending ? (
          <GalgameState loading message="正在載入品牌..." />
        ) : brands.isError ? (
          <GalgameState severity="error" message="品牌載入失敗，請稍後再試。" />
        ) : sortedBrands.length === 0 ? (
          <GalgameState message="目前尚無品牌資料。" />
        ) : (
          <>
            <Grid container spacing={3}>
              {sortedBrands.map((brand) => (
                <Grid key={brand.public_id} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ height: "100%" }}>
                    <CardActionArea
                      component={RouterLink}
                      to={`/galgame/${galgameBrandSlug(brand.public_id, brand.name)}`}
                      sx={{ height: "100%" }}
                    >
                      <CardContent>
                        <Stack alignItems="center" spacing={2}>
                          <Avatar src={brand.avatar_url} alt={brand.name} sx={{ width: 112, height: 112 }} />
                          <Typography variant="h6" textAlign="center">{brand.name}</Typography>
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Pagination
              page={page}
              count={pages}
              onChange={(_, value) => setParams(value > 1 ? { page: String(value) } : {})}
              sx={{ mt: 3, display: "flex", justifyContent: "center" }}
            />
          </>
        )}
      </Stack>
    </Box>
  );
}
