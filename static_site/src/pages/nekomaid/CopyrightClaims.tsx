import {
  Link as RouterLink,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Alert,
  Box,
  Breadcrumbs,
  Chip,
  Link,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";

import {
  COPYRIGHT_CLAIM_PAGE_SIZE,
  useCopyrightClaims,
} from "@/apis/nekomaid/copyrightClaim.ts";
import { formatSubmissionTime } from "@/helpers/avActressSubmission.ts";
import { nekomaidPath, siteLabels } from "@/helpers/nekomaid.ts";
import {
  CLAIM_STATUS_COLOR,
  CLAIM_STATUS_LABEL,
  copyrightClaimPath,
  nekomaidTargetPath,
} from "@/helpers/nekomaidForbidden.ts";
import { useTitle } from "@/helpers/title.tsx";
import type {
  CopyrightClaim,
  CopyrightClaimStatus,
} from "@/types/nekomaidForbidden.ts";

const STATUSES: (CopyrightClaimStatus | "")[] = [
  "",
  "pending",
  "approved",
  "rejected",
];

/**
 * 版權申告處理結果：/copyright-claim 列出全部，/copyright-claim/:hash 只列同一 IP 送出的申告。
 * 狀態與頁碼存在網址（?status=&page=）；後端不回傳 email、IP、說明，駁回才有理由
 */
export default function CopyrightClaimsPage() {
  const { hash = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const status = STATUSES.find((s) => s === params.get("status")) ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const claims = useCopyrightClaims(status, page, hash);
  const rows = claims.data?.data ?? [];
  const pageTitle = hash ? "你送出的申告" : "版權申告處理結果";
  // 網站名稱由 useTitle 依網域自動補上
  useTitle(pageTitle, { path: copyrightClaimPath(hash) });

  return (
    <Stack spacing={2} sx={{ maxWidth: 880, mx: "auto", textAlign: "left" }}>
      <Breadcrumbs aria-label="版權申告麵包屑" sx={{ fontSize: 14 }}>
        <Link component={RouterLink} to={nekomaidPath()} underline="hover">
          難以名狀的抓圖器
        </Link>
        {hash ? (
          <Link
            component={RouterLink}
            to={copyrightClaimPath()}
            underline="hover"
          >
            版權申告
          </Link>
        ) : (
          <Typography color="text.primary" fontWeight={800}>
            版權申告
          </Typography>
        )}
        {hash && (
          <Typography color="text.primary" fontWeight={800}>
            你送出的申告
          </Typography>
        )}
      </Breadcrumbs>
      <Typography component="h1" fontWeight={900} variant="h5">
        {pageTitle}
      </Typography>
      <Tabs
        onChange={(_, value: CopyrightClaimStatus | "") =>
          setParams(value ? { status: value } : {})
        }
        sx={{ borderBottom: 1, borderColor: "divider" }}
        value={status}
        variant="scrollable"
      >
        {STATUSES.map((s) => (
          <Tab
            key={s || "all"}
            label={s ? CLAIM_STATUS_LABEL[s] : "全部"}
            value={s}
          />
        ))}
      </Tabs>
      {claims.isPending ? (
        <Skeleton height={240} variant="rounded" />
      ) : claims.isError ? (
        <Alert severity="error">讀取申告失敗，請稍後再試</Alert>
      ) : rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ p: 4, textAlign: "center" }}>
          沒有申告
        </Typography>
      ) : (
        rows.map((claim) => <ClaimCard claim={claim} key={claim.id} />)
      )}
      {(claims.data?.total ?? 0) > COPYRIGHT_CLAIM_PAGE_SIZE && (
        <Pagination
          count={Math.ceil(
            (claims.data?.total ?? 0) / COPYRIGHT_CLAIM_PAGE_SIZE,
          )}
          onChange={(_, p) =>
            setParams({ ...(status ? { status } : {}), page: String(p) })
          }
          page={page}
          sx={{ alignSelf: "center" }}
        />
      )}
    </Stack>
  );
}

function ClaimCard({ claim }: { claim: CopyrightClaim }) {
  // 目標現在禁抓中（不論是不是這件申告造成的）時站內頁會 404，只顯示文字；解除後又會變回連結
  const linkable = !claim.is_forbidden;
  const targetLabel = claim.artwork_id
    ? `作品 ${claim.artwork_id}`
    : "整個畫師";
  return (
    <Paper sx={{ p: 2 }} variant="outlined">
      <Stack spacing={0.75}>
        <Stack
          alignItems="center"
          direction="row"
          flexWrap="wrap"
          justifyContent="space-between"
          useFlexGap
          gap={1}
        >
          <Typography fontWeight={800}>
            #{claim.id}・{claim.nickname || claim.author_id || "（無暱稱）"}
          </Typography>
          <Chip
            color={CLAIM_STATUS_COLOR[claim.status]}
            label={
              claim.status === "approved"
                ? "已核准，停止收錄"
                : CLAIM_STATUS_LABEL[claim.status]
            }
            size="small"
            variant="outlined"
          />
        </Stack>
        <Typography variant="body2">
          {siteLabels[claim.site] ?? claim.site}・
          {linkable ? (
            <Link
              component={RouterLink}
              to={nekomaidTargetPath(
                claim.site,
                claim.author_id,
                claim.artwork_id,
              )}
            >
              {targetLabel}
            </Link>
          ) : (
            targetLabel
          )}
        </Typography>
        {claim.status === "rejected" && claim.reviewer_note && (
          <Box
            sx={{
              bgcolor: "action.hover",
              borderLeft: 3,
              borderColor: "error.main",
              borderRadius: 1,
              px: 1.5,
              py: 1,
            }}
          >
            <Typography variant="body2">{claim.reviewer_note}</Typography>
          </Box>
        )}
        <Typography color="text.secondary" variant="caption">
          送出 {formatSubmissionTime(claim.created_at)}
          {claim.reviewed_at &&
            `・審核 ${formatSubmissionTime(claim.reviewed_at)}`}
        </Typography>
      </Stack>
    </Paper>
  );
}
