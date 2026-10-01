import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { STORYTELLER_VISIBILITY_LABELS } from "@/data/storyteller.ts";
import {
  auditActionLabel,
  auditActorLabel,
  auditOutcomeColors,
  auditOutcomeLabels,
  auditSourceLabels,
  auditTargetLabel,
  formatAuditTimestamp,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type { StorytellerAuditEvent } from "@/types/storyteller.ts";

// 專案欄位變更只顯示寫入端 allowlist 會記錄的欄位；沒列在這裡的 key 一律不顯示，
// 不做通用 JSON viewer，避免之後 summary 多了欄位就被原樣攤在畫面上。
const projectFieldLabels: Record<string, string> = {
  name: "名稱",
  slug: "網址代稱",
  description: "簡介",
  visibility: "公開範圍",
  rating: "分級",
  tags: "標籤",
  cover_asset_public_id: "封面",
  cover_layout: "封面版面",
  cover_focal_point: "封面焦點",
};

const summaryFieldLabels: Record<string, string> = {
  version_id: "版本",
  latest_version_id: "最新版本",
  target_version_id: "還原到的版本",
  base_version_id: "編輯時的基準版本",
  chat_id: "對話",
  provider: "AI 服務",
  model: "模型",
  input_tokens: "輸入 tokens",
  output_tokens: "輸出 tokens",
  count: "筆數",
  total_count: "總筆數",
  label: "名稱",
  secret_last4: "金鑰末四碼",
  public_id: "識別碼",
  memory_public_id: "記憶",
  reason: "原因",
  duration_ms: "耗時（毫秒）",
  client_name: "應用程式",
  client_id: "應用程式 ID",
  revoked_by: "撤銷者",
};

// 摘要裡值本身是代碼的欄位，換成中文顯示。
const summaryValueLabels: Record<string, Record<string, string>> = {
  revoked_by: { user: "使用者（OAuth Token 頁）", client: "應用程式自行撤銷" },
  reason: {
    expired: "憑證已過期",
    revoked: "授權已撤銷",
    reused: "使用已輪替掉的 refresh token",
    client_mismatch: "應用程式與授權時不符",
    concurrent: "同時有兩個換發請求",
  },
};

const errorCategoryLabels: Record<string, string> = {
  authorization: "權限或身分驗證",
  validation: "輸入內容不符規定",
  not_found: "找不到目標",
  conflict: "與目前資料衝突",
  internal: "伺服器內部錯誤",
  request: "請求無法處理",
  tool_execution: "工具執行失敗",
};

// 欄位值本身是代碼時換成中文（例如公開範圍），其餘照原值顯示。
const projectFieldValueLabels: Record<string, Record<string, string>> = {
  visibility: STORYTELLER_VISIBILITY_LABELS,
};

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "（空白）";
  if (Array.isArray(value)) return value.join("、") || "（空白）";
  if (typeof value === "object") return JSON.stringify(value);
  if (value === "expired") return "憑證已過期";
  return String(value);
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} sx={{ py: 0.5 }}>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ width: 112, flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ minWidth: 0, wordBreak: "break-all" }}>
        {value}
      </Typography>
    </Stack>
  );
}

function ProjectChanges({ changes }: { changes: Record<string, unknown> }) {
  const rows = Object.entries(changes).filter(
    ([field]) => field in projectFieldLabels,
  );
  if (rows.length === 0) return null;
  return (
    <Stack spacing={1}>
      {rows.map(([field, change]) => {
        const { before, after } = (change ?? {}) as {
          before?: unknown;
          after?: unknown;
        };
        return (
          <Box key={field}>
            <Typography variant="caption" color="text.secondary">
              {projectFieldLabels[field]}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              <Box
                component="span"
                sx={{ textDecoration: "line-through", color: "text.secondary" }}
              >
                {formatValue(
                  projectFieldValueLabels[field]?.[String(before)] ?? before,
                )}
              </Box>
              {" → "}
              {formatValue(
                projectFieldValueLabels[field]?.[String(after)] ?? after,
              )}
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

export function StorytellerAuditEventDetail({
  event,
}: {
  event: StorytellerAuditEvent;
}) {
  const summary = event.summary ?? {};
  const changes = summary.changes as Record<string, unknown> | undefined;
  const failed = event.outcome !== "success";
  const summaryRows = Object.entries(summary).filter(
    ([key]) => key in summaryFieldLabels,
  );
  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6" fontWeight={800}>
          {auditActionLabel(event.action)}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap">
          <Chip
            size="small"
            color={auditOutcomeColors[event.outcome]}
            label={auditOutcomeLabels[event.outcome]}
          />
          <Chip
            size="small"
            variant="outlined"
            label={auditSourceLabels[event.source]}
          />
        </Stack>
      </Box>
      <Stack>
        <DetailRow
          label="時間"
          value={formatAuditTimestamp(event.occurred_at)}
        />
        <DetailRow label="操作者" value={auditActorLabel(event)} />
        {event.target && (
          <DetailRow label="目標" value={auditTargetLabel(event)} />
        )}
        {event.credential && (
          <DetailRow
            label="使用的憑證"
            value={`${event.credential.label}（${event.credential.public_id}）`}
          />
        )}
      </Stack>
      {changes && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            變更內容
          </Typography>
          <ProjectChanges changes={changes} />
        </>
      )}
      {failed && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            {event.outcome === "denied" ? "拒絕原因" : "失敗原因"}
          </Typography>
          <Stack>
            <DetailRow
              label="原因分類"
              value={
                errorCategoryLabels[String(summary.error_category ?? "")] ??
                "未分類"
              }
            />
            {summary.http_status !== undefined && (
              <DetailRow
                label="HTTP 狀態"
                value={String(summary.http_status)}
              />
            )}
            {summary.custom_code !== undefined && (
              <DetailRow label="錯誤代碼" value={String(summary.custom_code)} />
            )}
          </Stack>
        </>
      )}
      {summaryRows.length > 0 && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            摘要
          </Typography>
          <Stack>
            {summaryRows.map(([key, value]) => (
              <DetailRow
                key={key}
                label={summaryFieldLabels[key]}
                value={
                  summaryValueLabels[key]?.[String(value)] ?? formatValue(value)
                }
              />
            ))}
          </Stack>
        </>
      )}
      <Divider />
      <Typography variant="subtitle2" fontWeight={800}>
        連線與追蹤
      </Typography>
      <Stack>
        <DetailRow label="IP 位址" value={event.ip || "—"} />
        <DetailRow label="User-Agent" value={event.user_agent || "—"} />
        <DetailRow label="Request ID" value={event.request_id || "—"} />
        <DetailRow label="事件 ID" value={event.event_id} />
      </Stack>
    </Stack>
  );
}
