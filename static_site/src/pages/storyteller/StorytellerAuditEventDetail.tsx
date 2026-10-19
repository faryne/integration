import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import {
  auditActionLabel,
  auditActorLabel,
  auditOutcomeColors,
  auditOutcomeLabel,
  auditSourceLabel,
  auditTargetLabel,
  formatAuditTimestamp,
} from "@/pages/storyteller/storytellerAuditUI.ts";
import type { StorytellerAuditEvent } from "@/types/storyteller.ts";

// 專案欄位變更只顯示寫入端 allowlist 會記錄的欄位；沒列在這裡的 key 一律不顯示，
// 不做通用 JSON viewer，避免之後 summary 多了欄位就被原樣攤在畫面上。
// 欄位名稱翻譯在 web.audit.detail.projectFields.*
const projectFields = [
  "name",
  "slug",
  "description",
  "visibility",
  "rating",
  "tags",
  "cover_asset_public_id",
  "cover_layout",
  "cover_focal_point",
];

// summary 只顯示這些欄位，名稱翻譯在 web.audit.detail.summaryFields.*
const summaryFields = [
  "version_id",
  "latest_version_id",
  "target_version_id",
  "base_version_id",
  "chat_id",
  "provider",
  "model",
  "input_tokens",
  "output_tokens",
  "count",
  "total_count",
  "label",
  "secret_last4",
  "public_id",
  "memory_public_id",
  "reason",
  "duration_ms",
  "client_name",
  "client_id",
  "revoked_by",
];

// 欄位值本身是代碼時換成翻譯（例如公開範圍、撤銷原因），其餘照原值顯示；
// 翻譯檔有對應 key 才換，沒有就原樣顯示（非元件 helper，用全域 i18next）。
function codeLabel(prefix: string, value: unknown) {
  const key = `${prefix}.${String(value)}`;
  return i18n.exists(key) ? i18n.t(key) : undefined;
}

function formatValue(value: unknown) {
  const empty = i18n.t("web.audit.detail.empty");
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value))
    return value.join(i18n.t("web.notification.listSeparator")) || empty;
  if (typeof value === "object") return JSON.stringify(value);
  if (value === "expired")
    return i18n.t("web.audit.detail.summaryValues.reason.expired");
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
  const { t } = useTranslation();
  const rows = Object.entries(changes).filter(([field]) =>
    projectFields.includes(field),
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
              {t(`web.audit.detail.projectFields.${field}`)}
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: "break-all" }}>
              <Box
                component="span"
                sx={{ textDecoration: "line-through", color: "text.secondary" }}
              >
                {formatValue(
                  field === "visibility"
                    ? (codeLabel("web.visibility", before) ?? before)
                    : before,
                )}
              </Box>
              {" → "}
              {formatValue(
                field === "visibility"
                  ? (codeLabel("web.visibility", after) ?? after)
                  : after,
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
  const { t } = useTranslation();
  const summary = event.summary ?? {};
  const changes = summary.changes as Record<string, unknown> | undefined;
  const failed = event.outcome !== "success";
  const summaryRows = Object.entries(summary).filter(([key]) =>
    summaryFields.includes(key),
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
            label={auditOutcomeLabel(event.outcome)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={auditSourceLabel(event.source)}
          />
        </Stack>
      </Box>
      <Stack>
        <DetailRow
          label={t("web.audit.detail.time")}
          value={formatAuditTimestamp(event.occurred_at)}
        />
        <DetailRow
          label={t("web.audit.detail.actor")}
          value={auditActorLabel(event)}
        />
        {event.target && (
          <DetailRow
            label={t("web.audit.detail.target")}
            value={auditTargetLabel(event)}
          />
        )}
        {event.credential && (
          <DetailRow
            label={t("web.audit.detail.credential")}
            value={`${event.credential.label}（${event.credential.public_id}）`}
          />
        )}
      </Stack>
      {changes && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            {t("web.audit.detail.changes")}
          </Typography>
          <ProjectChanges changes={changes} />
        </>
      )}
      {failed && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            {event.outcome === "denied"
              ? t("web.audit.detail.deniedReason")
              : t("web.audit.detail.failedReason")}
          </Typography>
          <Stack>
            <DetailRow
              label={t("web.audit.detail.errorCategory")}
              value={
                codeLabel(
                  "web.audit.detail.errorCategories",
                  summary.error_category,
                ) ?? t("web.audit.detail.uncategorized")
              }
            />
            {summary.http_status !== undefined && (
              <DetailRow
                label={t("web.audit.detail.httpStatus")}
                value={String(summary.http_status)}
              />
            )}
            {summary.custom_code !== undefined && (
              <DetailRow
                label={t("web.audit.detail.errorCode")}
                value={String(summary.custom_code)}
              />
            )}
          </Stack>
        </>
      )}
      {summaryRows.length > 0 && (
        <>
          <Divider />
          <Typography variant="subtitle2" fontWeight={800}>
            {t("web.audit.detail.summary")}
          </Typography>
          <Stack>
            {summaryRows.map(([key, value]) => (
              <DetailRow
                key={key}
                label={t(`web.audit.detail.summaryFields.${key}`)}
                value={
                  codeLabel(`web.audit.detail.summaryValues.${key}`, value) ??
                  formatValue(value)
                }
              />
            ))}
          </Stack>
        </>
      )}
      <Divider />
      <Typography variant="subtitle2" fontWeight={800}>
        {t("web.audit.detail.connection")}
      </Typography>
      <Stack>
        <DetailRow label={t("web.audit.detail.ip")} value={event.ip || "—"} />
        <DetailRow label="User-Agent" value={event.user_agent || "—"} />
        <DetailRow label="Request ID" value={event.request_id || "—"} />
        <DetailRow
          label={t("web.audit.detail.eventId")}
          value={event.event_id}
        />
      </Stack>
    </Stack>
  );
}
