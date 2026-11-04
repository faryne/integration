import { useState } from "react";
import { Button, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestoreIcon from "@mui/icons-material/Restore";
import SyncIcon from "@mui/icons-material/Sync";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameBrands,
  useGalgameBrandAdminAction,
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
import { useTabParam } from "@/components/backendAdmin/useTabParam.ts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog.tsx";
import type { GalgameBrand } from "@/types/galgame.ts";

const TABS = ["all", "paused", "deleted"] as const;

/** 頻道管理：/backend_admin/galgame/brands?tab=all|paused|deleted */
export function GalgameAdminBrands() {
  const { t } = useTranslation();
  const [tab, setTab] = useTabParam(TABS);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<GalgameBrand | null>(null);
  // 「全部頻道」只列已核准的；待審的在待審頻道頁處理
  const brands = useAdminGalgameBrands(
    tab === "all" ? "approved" : tab,
    page,
    GALGAME_ADMIN_PAGE_SIZE,
    keyword,
  );
  const setStatus = useSetGalgameBrandStatus();
  const action = useGalgameBrandAdminAction();
  const feedback = useActionFeedback(t("galgame.admin.actionFailed"));
  const run = (
    brandId: number,
    act: Parameters<typeof action.mutate>[0]["action"],
  ) => action.mutate({ brandId, action: act }, { onError: feedback.failed });

  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {t("galgame.admin.tabs.brands")}
      </Typography>
      <TextField
        label={t("galgame.admin.brands.search")}
        onChange={(event) => {
          setKeyword(event.target.value);
          setPage(1);
        }}
        size="small"
        value={keyword}
      />
      <Tabs
        onChange={(_, value: (typeof TABS)[number]) => {
          setTab(value);
          setPage(1);
        }}
        value={tab}
      >
        {TABS.map((key) => (
          <Tab
            key={key}
            label={t(`galgame.admin.brands.tabs.${key}`)}
            value={key}
          />
        ))}
      </Tabs>
      <GalgameAdminList
        emptyMessage={t("galgame.admin.brands.empty")}
        loadingMessage={t("galgame.admin.brands.loading")}
        onPageChange={setPage}
        page={page}
        query={brands}
        renderItem={(brand) => (
          <BrandAdminCard brand={brand} key={brand.id}>
            {/* 暫停索引／已刪除的頻道仍可能停在待審狀態，保留核准／拒絕 */}
            {brand.status === "pending" && (
              <ReviewButtons
                disabled={setStatus.isPending}
                onReview={(status) =>
                  setStatus.mutate(
                    { brandId: brand.id, status },
                    { onError: feedback.failed },
                  )
                }
              />
            )}
            {tab === "deleted" ? (
              <Button
                disabled={action.isPending}
                onClick={() => run(brand.id, "restore")}
                startIcon={<RestoreIcon />}
              >
                {t("galgame.admin.actions.restore")}
              </Button>
            ) : tab === "paused" ? (
              <Button
                disabled={action.isPending}
                onClick={() => run(brand.id, "resume")}
                startIcon={<PlayArrowIcon />}
              >
                {t("galgame.admin.actions.resumeIndexing")}
              </Button>
            ) : (
              <>
                <Button
                  disabled={action.isPending}
                  onClick={() => run(brand.id, "pause")}
                  startIcon={<PauseIcon />}
                >
                  {t("galgame.admin.actions.pauseIndexing")}
                </Button>
                <Button
                  disabled={action.isPending}
                  onClick={() => run(brand.id, "sync")}
                  startIcon={<SyncIcon />}
                >
                  {t("galgame.admin.actions.fullIndex")}
                </Button>
                <Button
                  color="error"
                  disabled={action.isPending}
                  onClick={() => setDeleting(brand)}
                  startIcon={<DeleteIcon />}
                >
                  {t("galgame.admin.actions.delete")}
                </Button>
              </>
            )}
          </BrandAdminCard>
        )}
      />
      <ConfirmDialog
        cancelLabel={t("galgame.admin.confirm.cancel")}
        confirmLabel={t("galgame.admin.actions.delete")}
        loading={action.isPending}
        message={t("galgame.admin.confirm.deleteBrand", {
          name: deleting?.name,
        })}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) run(deleting.id, "delete");
          setDeleting(null);
        }}
        open={deleting !== null}
        title={t("galgame.admin.confirm.title")}
      />
      {feedback.snackbar}
    </Stack>
  );
}
