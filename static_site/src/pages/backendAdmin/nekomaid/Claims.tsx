import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from "@mui/material";

import {
  NEKOMAID_ADMIN_PAGE_SIZE,
  useNekomaidClaimsAdmin,
  usePendingNekomaidClaimCount,
  useReviewNekomaidClaim,
} from "@/apis/nekomaid/forbiddenAdmin.ts";
import { AdminPagination } from "@/components/backendAdmin/AdminPagination.tsx";
import { ClaimReviewDialog } from "@/components/backendAdmin/nekomaid/ClaimReviewDialog.tsx";
import { useActionFeedback } from "@/components/backendAdmin/useActionFeedback.tsx";
import { useTabParam } from "@/components/backendAdmin/useTabParam.ts";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { formatSubmissionTime } from "@/helpers/avActressSubmission.ts";
import { siteAuthorUrl, siteLabels } from "@/helpers/nekomaid.ts";
import {
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
  nekomaidTargetPath,
} from "@/helpers/nekomaidForbidden.ts";
import type { CopyrightClaimAdminItem } from "@/types/nekomaidForbidden.ts";

const TABS = ["pending", "approved", "rejected", "all"] as const;
const TAB_LABEL = { ...CLAIM_STATUS_LABEL, pending: "待審", all: "全部" };

/**
 * 版權申告審核：/backend_admin/nekomaid/claims?tab=pending|approved|rejected|all。
 * 核准會寫進禁抓名單，由同步 job 把作品從搜尋拉掉；同一 IP 送很多件時點「同 IP N 件」看該來源的所有申告
 */
export function NekomaidAdminClaims() {
  const [tab, setTab] = useTabParam(TABS);
  const [ip, setIp] = useState("");
  const [page, setPage] = useState(1);
  // 關閉時保留最後一筆，對話框收起的動畫期間標題與內容不會跳掉
  const [reviewing, setReviewing] = useState<{
    claim: CopyrightClaimAdminItem;
    approve: boolean;
    open: boolean;
  } | null>(null);
  const closeReview = () =>
    setReviewing((prev) => (prev ? { ...prev, open: false } : prev));
  const [notice, setNotice] = useState("");
  const list = useNekomaidClaimsAdmin({
    status: tab === "all" ? "" : tab,
    ip,
    page,
  });
  const pending = usePendingNekomaidClaimCount(true);
  const review = useReviewNekomaidClaim();
  const feedback = useActionFeedback("操作失敗，請稍後再試");
  const rows = list.data?.data ?? [];

  const filterByIp = (value: string) => {
    setIp(value);
    setPage(1);
  };

  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Typography component="h1" fontWeight={900} variant="h5">
        版權申告
      </Typography>
      {ip && (
        <Box>
          <Chip label={`IP：${ip}`} onDelete={() => filterByIp("")} />
        </Box>
      )}
      <Paper variant="outlined">
        <Tabs
          onChange={(_, value: (typeof TABS)[number]) => {
            setTab(value);
            setPage(1);
          }}
          sx={{ borderBottom: 1, borderColor: "divider", px: 1 }}
          value={tab}
        >
          {TABS.map((key) => (
            <Tab
              key={key}
              label={
                key === "pending" && pending.data
                  ? `${TAB_LABEL[key]}（${pending.data}）`
                  : TAB_LABEL[key]
              }
              value={key}
            />
          ))}
        </Tabs>
        {list.isPending ? (
          <Skeleton height={240} sx={{ m: 2 }} variant="rounded" />
        ) : rows.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>
            沒有申告
          </Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>送出時間</TableCell>
                  <TableCell>畫師</TableCell>
                  <TableCell>範圍</TableCell>
                  <TableCell>聯絡 email</TableCell>
                  <TableCell>說明</TableCell>
                  <TableCell>IP</TableCell>
                  <TableCell>狀態</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((claim) => (
                  <ClaimRow
                    claim={claim}
                    key={claim.id}
                    onFilterIp={filterByIp}
                    onReview={(approve) =>
                      setReviewing({ claim, approve, open: true })
                    }
                  />
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>
      <AdminPagination
        onChange={setPage}
        page={page}
        perPage={list.data?.per_page ?? NEKOMAID_ADMIN_PAGE_SIZE}
        total={list.data?.total}
      />

      <ClaimReviewDialog
        approve={reviewing?.approve ?? true}
        claim={reviewing?.claim ?? null}
        loading={review.isPending}
        onClose={closeReview}
        open={reviewing?.open ?? false}
        onSubmit={(note) => {
          if (!reviewing) return;
          const approve = reviewing.approve;
          review.mutate(
            { id: reviewing.claim.id, approve, note },
            {
              onSuccess: () => {
                closeReview();
                setNotice(approve ? "已核准，5 分鐘內從搜尋移除" : "已駁回");
              },
              onError: feedback.failed,
            },
          );
        }}
      />
      <CustomSnackbar
        message={notice}
        onClose={() => setNotice("")}
        open={notice !== ""}
      />
      {feedback.snackbar}
    </Stack>
  );
}

function ClaimRow({
  claim,
  onReview,
  onFilterIp,
}: {
  claim: CopyrightClaimAdminItem;
  onReview: (approve: boolean) => void;
  onFilterIp: (ip: string) => void;
}) {
  const authorUrl = siteAuthorUrl(claim.site, claim.author_id);
  return (
    <TableRow sx={{ verticalAlign: "top" }}>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {formatSubmissionTime(claim.created_at)}
      </TableCell>
      <TableCell>
        {claim.nickname || (
          <Typography color="text.secondary" component="span" variant="body2">
            （無暱稱）
          </Typography>
        )}
        <Typography color="text.secondary" display="block" variant="caption">
          {siteLabels[claim.site] ?? claim.site} ·{" "}
          {authorUrl ? (
            <Link href={authorUrl} rel="noopener" target="_blank">
              {claim.author_id} ↗
            </Link>
          ) : (
            claim.author_id
          )}
        </Typography>
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Link
          href={nekomaidTargetPath(
            claim.site,
            claim.author_id,
            claim.artwork_id,
          )}
          rel="noopener"
          target="_blank"
        >
          {claim.artwork_id ? `作品 ${claim.artwork_id}` : "整個畫師"}
        </Link>
      </TableCell>
      <TableCell>{claim.contact_email || "—"}</TableCell>
      <TableCell sx={{ maxWidth: 320, whiteSpace: "pre-wrap" }}>
        {claim.message || "—"}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        {claim.ip || "—"}
        {claim.ip_count > 1 && (
          <Chip
            clickable
            color="error"
            label={`同 IP ${claim.ip_count} 件`}
            onClick={() => onFilterIp(claim.ip)}
            size="small"
            sx={{ display: "flex", mt: 0.5, width: "fit-content" }}
            variant="outlined"
          />
        )}
      </TableCell>
      <TableCell sx={{ whiteSpace: "nowrap" }}>
        <Chip
          color={CLAIM_STATUS_COLOR[claim.status]}
          label={CLAIM_STATUS_LABEL[claim.status]}
          size="small"
          variant="outlined"
        />
        {claim.reviewed_at && (
          <Typography color="text.secondary" display="block" variant="caption">
            {formatSubmissionTime(claim.reviewed_at)}
          </Typography>
        )}
        {claim.reviewer_note && (
          <Typography
            display="block"
            sx={{ whiteSpace: "normal" }}
            variant="caption"
          >
            {claim.reviewer_note}
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {claim.status === "pending" && (
          <Stack direction="row" spacing={1}>
            <Button
              onClick={() => onReview(true)}
              size="small"
              variant="contained"
            >
              核准
            </Button>
            <Button
              color="error"
              onClick={() => onReview(false)}
              size="small"
              variant="outlined"
            >
              駁回
            </Button>
          </Stack>
        )}
      </TableCell>
    </TableRow>
  );
}
