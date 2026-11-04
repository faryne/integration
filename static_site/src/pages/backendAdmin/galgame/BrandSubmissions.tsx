import { useState } from "react";
import { Stack, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameBrands,
  useSetGalgameBrandStatus,
} from "@/apis/galgame/admin.ts";
import {
  BrandAdminCard,
  ReviewButtons,
} from "@/components/backendAdmin/galgame/GalgameAdminCards.tsx";
import {
  GALGAME_ADMIN_PAGE_SIZE,
  GalgameAdminList,
} from "@/components/backendAdmin/galgame/GalgameAdminList.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";

/** 待審頻道：/backend_admin/galgame/brand-submissions */
export function GalgameAdminBrandSubmissions() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const brands = useAdminGalgameBrands(
    "pending",
    page,
    GALGAME_ADMIN_PAGE_SIZE,
  );
  const setStatus = useSetGalgameBrandStatus();
  const feedback = useActionFeedback(t("galgame.admin.actionFailed"));

  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {t("galgame.admin.tabs.pendingBrands")}
      </Typography>
      <GalgameAdminList
        emptyMessage={t("galgame.admin.pendingBrands.empty")}
        loadingMessage={t("galgame.admin.pendingBrands.loading")}
        onPageChange={setPage}
        page={page}
        query={brands}
        renderItem={(brand) => (
          <BrandAdminCard brand={brand} key={brand.id}>
            <ReviewButtons
              disabled={setStatus.isPending}
              onReview={(status) =>
                setStatus.mutate(
                  { brandId: brand.id, status },
                  { onError: feedback.failed },
                )
              }
            />
          </BrandAdminCard>
        )}
      />
      {feedback.snackbar}
    </Stack>
  );
}
