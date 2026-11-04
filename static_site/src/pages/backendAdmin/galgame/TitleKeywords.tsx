import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";

import {
  useAdminGalgameVideoTitleKeywords,
  useCreateGalgameVideoTitleKeyword,
  useDeleteGalgameVideoTitleKeyword,
  useUpdateGalgameVideoTitleKeyword,
} from "@/apis/galgame/admin.ts";
import {
  GALGAME_ADMIN_PAGE_SIZE,
  GalgameAdminList,
} from "@/components/backendAdmin/galgame/GalgameAdminList.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";
import { useTabParam } from "@/components/backendAdmin/useTabParam.ts";
import { ConfirmDialog } from "@/components/common/ConfirmDialog.tsx";
import type { GalgameVideoTitleKeyword } from "@/types/galgame.ts";

const TABS = ["all", "enabled", "disabled"] as const;
// 後端的 enabled 篩選值
const ENABLED_FILTER = { all: "all", enabled: "true", disabled: "false" };

/** 影片關鍵字（影片標題比對用）：/backend_admin/galgame/title-keywords?tab=all|enabled|disabled */
export function GalgameAdminTitleKeywords() {
  const { t } = useTranslation();
  const [tab, setTab] = useTabParam(TABS);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [newKeyword, setNewKeyword] = useState("");
  const [deleting, setDeleting] = useState<GalgameVideoTitleKeyword | null>(
    null,
  );
  const keywords = useAdminGalgameVideoTitleKeywords(
    search,
    ENABLED_FILTER[tab],
    page,
    GALGAME_ADMIN_PAGE_SIZE,
  );
  const create = useCreateGalgameVideoTitleKeyword();
  const update = useUpdateGalgameVideoTitleKeyword();
  const remove = useDeleteGalgameVideoTitleKeyword();
  const feedback = useActionFeedback(t("galgame.admin.actionFailed"));

  return (
    <Stack spacing={2}>
      <Typography component="h1" fontWeight={900} variant="h5">
        {t("galgame.admin.tabs.titleKeywords")}
      </Typography>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        <TextField
          label={t("galgame.admin.keywords.new")}
          onChange={(event) => setNewKeyword(event.target.value)}
          size="small"
          sx={{ flex: 1 }}
          value={newKeyword}
        />
        <Button
          disabled={newKeyword.trim() === "" || create.isPending}
          onClick={() =>
            create.mutate(newKeyword.trim(), {
              onSuccess: () => setNewKeyword(""),
              onError: feedback.failed,
            })
          }
          variant="contained"
        >
          {t("galgame.admin.actions.add")}
        </Button>
      </Stack>
      <TextField
        label={t("galgame.admin.keywords.search")}
        onChange={(event) => {
          setSearch(event.target.value);
          setPage(1);
        }}
        size="small"
        value={search}
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
            label={t(`galgame.admin.keywords.tabs.${key}`)}
            value={key}
          />
        ))}
      </Tabs>
      <GalgameAdminList
        emptyMessage={t("galgame.admin.keywords.empty")}
        loadingMessage={t("galgame.admin.keywords.loading")}
        onPageChange={setPage}
        page={page}
        query={keywords}
        renderItem={(keyword) => (
          <Grid key={keyword.id} size={{ xs: 12, md: 6 }}>
            <Card variant="outlined">
              <CardContent>
                <Stack alignItems="center" direction="row" spacing={1.5}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>
                      {keyword.keyword}
                    </Typography>
                    <Chip
                      color={keyword.enabled ? "success" : "default"}
                      label={t(
                        `galgame.admin.keywords.${keyword.enabled ? "enabled" : "disabled"}`,
                      )}
                      size="small"
                      sx={{ mt: 0.75 }}
                    />
                  </Box>
                  <Button
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate(
                        { keywordId: keyword.id, enabled: !keyword.enabled },
                        { onError: feedback.failed },
                      )
                    }
                  >
                    {t(
                      `galgame.admin.actions.${keyword.enabled ? "disable" : "enable"}`,
                    )}
                  </Button>
                  <Button
                    color="error"
                    disabled={remove.isPending}
                    onClick={() => setDeleting(keyword)}
                    startIcon={<DeleteIcon />}
                  >
                    {t("galgame.admin.actions.delete")}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        )}
      />
      <ConfirmDialog
        cancelLabel={t("galgame.admin.confirm.cancel")}
        confirmLabel={t("galgame.admin.actions.delete")}
        loading={remove.isPending}
        message={t("galgame.admin.confirm.deleteKeyword", {
          keyword: deleting?.keyword,
        })}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting)
            remove.mutate(deleting.id, { onError: feedback.failed });
          setDeleting(null);
        }}
        open={deleting !== null}
        title={t("galgame.admin.confirm.title")}
      />
      {feedback.snackbar}
    </Stack>
  );
}
