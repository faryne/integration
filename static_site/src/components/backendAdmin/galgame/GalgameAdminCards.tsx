import type { ReactNode } from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";

import type { GalgameBrand } from "@/types/galgame.ts";

/** galgame 管理頁共用的兩欄卡片格線 */
export function AdminCardGrid({ children }: { children: ReactNode }) {
  return (
    <Grid container spacing={2}>
      {children}
    </Grid>
  );
}

/** 頻道卡片：頭像、名稱、狀態 chip，操作按鈕由各頁帶入 */
export function BrandAdminCard({
  brand,
  children,
}: {
  brand: GalgameBrand;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack alignItems="center" direction="row" spacing={1.5}>
              <Avatar alt={brand.name} src={brand.avatar_url} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography fontWeight={700} noWrap>
                  {brand.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                  <Chip
                    label={t(`galgame.status.${brand.status}`)}
                    size="small"
                  />
                  {brand.index_paused_at && (
                    <Chip
                      label={t("galgame.admin.brands.paused")}
                      size="small"
                    />
                  )}
                  {brand.deleted_at && (
                    <Chip
                      color="error"
                      label={t("galgame.admin.deleted")}
                      size="small"
                    />
                  )}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" flexWrap="wrap" spacing={1}>
              {children}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}

/** 影片卡片（影片管理、待審影片共用）：縮圖、標題、副標，操作按鈕由各頁帶入 */
export function VideoAdminCard({
  thumbnailUrl,
  title,
  subtitle,
  children,
}: {
  thumbnailUrl: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1.5}>
            <Box
              alt={title}
              component="img"
              src={thumbnailUrl}
              sx={{
                aspectRatio: "16 / 9",
                borderRadius: 1,
                objectFit: "cover",
                width: 128,
              }}
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} noWrap>
                {title}
              </Typography>
              <Typography color="text.secondary" noWrap>
                {subtitle}
              </Typography>
              <Stack direction="row" flexWrap="wrap" spacing={1} sx={{ mt: 1 }}>
                {children}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  );
}

/** 待審項目（頻道、影片）的核准／拒絕按鈕 */
export function ReviewButtons({
  disabled,
  onReview,
}: {
  disabled: boolean;
  onReview: (status: "approved" | "rejected") => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Button
        color="success"
        disabled={disabled}
        onClick={() => onReview("approved")}
        startIcon={<CheckIcon />}
      >
        {t("galgame.admin.actions.approve")}
      </Button>
      <Button
        color="error"
        disabled={disabled}
        onClick={() => onReview("rejected")}
        startIcon={<CloseIcon />}
      >
        {t("galgame.admin.actions.reject")}
      </Button>
    </>
  );
}
