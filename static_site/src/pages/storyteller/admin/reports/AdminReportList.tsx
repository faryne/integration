import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import {
  Box,
  Chip,
  Pagination,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { useAdminReports } from "@/apis/storyteller.ts";
import { CustomEmptyState } from "@/components/common/CustomEmptyState.tsx";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { postTimeLabel } from "@/components/storyteller/timeline/postTime.ts";
import { apiErrorMessage } from "@/helpers/apiError.ts";
import { moderationReasonLabel } from "@/helpers/moderationReasons.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import {
  StorytellerLoading,
  StorytellerShell,
} from "@/pages/storyteller/StorytellerShell.tsx";
import type {
  AdminReportGroup,
  AdminReportStatus,
  AdminTargetFilter,
} from "@/types/storytellerAdmin.ts";
import {
  adminStatusTabs,
  adminTargetFilters,
  adminTargetName,
  adminTargetPlace,
  adminTargetTypeLabels,
} from "./adminReportLabels.ts";

// 每頁筆數跟後端 AdminReportPageSize 一致
const PAGE_SIZE = 20;

// 檢舉列表：一列＝一個被檢舉的對象。待處理依檢舉數多→少排（越多人檢舉越優先），
// 已結案／已駁回依處理時間新→舊。狀態、種類、頁碼都放網址，返回列表時保持原樣。
export function AdminReportList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = (searchParams.get("status") ?? "pending") as AdminReportStatus;
  const targetType = (searchParams.get("type") || undefined) as
    AdminTargetFilter | undefined;
  const page = Number(searchParams.get("page") ?? 1) || 1;
  const query = useAdminReports({ status, targetType, page });
  // 載入失敗的 snack 關掉後就不再跳，直到下次失敗
  const [errorDismissed, setErrorDismissed] = useState(false);
  const counts = query.data?.counts ?? {};
  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setSearchParams(next, { replace: true });
  };

  return (
    <StorytellerShell
      title="檢舉"
      breadcrumbs={[
        { label: STORYTELLER_APP_NAME, to: steamloomPath() },
        { label: "管理後台", to: steamloomPath("admin") },
        { label: "檢舉" },
      ]}
    >
      <Stack spacing={1.5}>
        <Tabs
          value={status}
          onChange={(_, value) => update({ status: value, page: undefined })}
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          {adminStatusTabs.map(([value, label]) => (
            <Tab
              key={value}
              value={value}
              label={`${label} ${counts[value] ?? 0}`}
            />
          ))}
        </Tabs>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
          {adminTargetFilters.map(([value, label]) => (
            <Chip
              key={label}
              label={label}
              clickable
              color={(targetType ?? "") === value ? "primary" : "default"}
              variant={(targetType ?? "") === value ? "filled" : "outlined"}
              onClick={() =>
                update({ type: value || undefined, page: undefined })
              }
            />
          ))}
        </Stack>
        {query.isLoading ? (
          <StorytellerLoading label="正在載入檢舉..." />
        ) : (query.data?.items.length ?? 0) === 0 ? (
          <CustomEmptyState icon={<FlagOutlinedIcon />} title="沒有檢舉" />
        ) : (
          <Paper variant="outlined">
            {query.data!.items.map((group) => (
              <AdminReportRow
                key={`${group.target.type}:${group.target.public_id}`}
                group={group}
                status={status}
              />
            ))}
          </Paper>
        )}
        {(query.data?.total ?? 0) > PAGE_SIZE && (
          <Pagination
            sx={{ alignSelf: "center" }}
            page={page}
            count={Math.ceil(query.data!.total / PAGE_SIZE)}
            onChange={(_, value) =>
              update({ page: value > 1 ? String(value) : undefined })
            }
          />
        )}
      </Stack>
      <CustomSnackbar
        open={query.isError && !errorDismissed}
        severity="error"
        message={apiErrorMessage(query.error, "無法載入檢舉，請稍後再試")}
        onClose={() => setErrorDismissed(true)}
      />
    </StorytellerShell>
  );
}

function AdminReportRow({
  group,
  status,
}: {
  group: AdminReportGroup;
  status: AdminReportStatus;
}) {
  const { target } = group;
  const place = adminTargetPlace(target);
  const handledAt = status === "pending" ? undefined : group.last_handled_at;
  return (
    <Box
      component={RouterLink}
      to={steamloomPath(`admin/reports/${target.type}/${target.public_id}`)}
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "48px minmax(0, 1fr)",
          md: "56px minmax(0, 1fr) 220px 110px",
        },
        gap: { xs: 1, md: 2 },
        alignItems: "center",
        px: 2,
        py: 1.5,
        color: "inherit",
        textDecoration: "none",
        "& + &": { borderTop: 1, borderColor: "divider" },
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Box sx={{ textAlign: "center" }}>
        <Typography
          variant="h5"
          fontWeight={800}
          color={status === "pending" ? "error.main" : "text.secondary"}
          lineHeight={1}
        >
          {group.count}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {status === "pending" ? "待處理" : "筆檢舉"}
        </Typography>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label={adminTargetTypeLabels[target.type]}
          />
          <Typography fontWeight={700}>{adminTargetName(target)}</Typography>
          {target.deleted && (
            <Chip
              size="small"
              variant="outlined"
              label={
                target.delete_reason
                  ? target.type === "user"
                    ? "已停權"
                    : "已移除"
                  : "作者已自行刪除"
              }
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" noWrap>
          {[target.excerpt, place].filter(Boolean).join("　·　")}
        </Typography>
      </Box>
      <Stack
        direction="row"
        spacing={0.5}
        flexWrap="wrap"
        useFlexGap
        sx={{ gridColumn: { xs: 2, md: "auto" } }}
      >
        {group.reasons.slice(0, 2).map((reason) => (
          <Chip
            key={reason.key}
            size="small"
            color="error"
            variant="outlined"
            label={`${moderationReasonLabel(reason.key)} ×${reason.count}`}
          />
        ))}
      </Stack>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ gridColumn: { xs: 2, md: "auto" }, textAlign: { md: "right" } }}
      >
        {postTimeLabel(handledAt ?? group.last_reported_at)}
      </Typography>
    </Box>
  );
}
