import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CloseIcon from "@mui/icons-material/Close";
import {
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
// 網站與 SteamLoom Writer 共用；Writer 透過 alias 直接 import（改這支也會影響 Writer）。
import { buildCustomLineDiff } from "../../components/common/customDiff.ts";
import { CustomDiffLegend } from "../../components/common/CustomDiffLegend.tsx";
import { CustomDiffSection } from "../../components/common/CustomDiffSection.tsx";
import { formatStorytellerDate } from "../../data/storytellerDate.ts";
import {
  extractFootnoteNotesForDiff,
  stripMarkerForDiffContent,
} from "./wysiwygCore/parser.ts";

// 故事有摘要、設定集沒有，summary 留 undefined 就代表這個類型不比對摘要——
// 兩邊呼叫端（StoryEditor／LoreEditor）都直接把 apiStoryVersions／apiLoreVersions
// 裡已經載入好的版本物件（含完整 content）原樣傳進來，不用另外發請求，跟原本
// 獨立頁面（StoryDiffCompare／LoreDiffCompare）不一樣，那邊沒有預先載入的資料
// 可以借，才需要自己重新 fetch 兩個版本。
export interface StorytellerVersionCompareEntry {
  title: string;
  summary?: string;
  content: string;
  // 內容欄位的標題——故事/設定集是「內容」，AI Agent 是「Prompt 內容」；預設「內容」。
  contentLabel?: string;
  // 內容以外，額外需要逐欄比對的簡單文字欄位（例如 AI Agent 的供應商／模型名稱），
  // 依序插在摘要跟內容中間；左右版本用 key 對應。
  extraFields?: { key: string; label: string; value: string }[];
  // 是否額外拉出腳注區塊比對——只有故事/設定集的內容會經過 wysiwyg 解析器，
  // AI Agent 的 prompt 是純文字，沒有腳注語法，預設仍是 true 但由呼叫端關掉。
  includeFootnotes?: boolean;
  source: string;
  createdAt: string;
}

export function StorytellerVersionCompareDialog({
  open,
  onClose,
  itemTitle,
  leftVersion,
  rightVersion,
  dialogTitle,
  leftVersionLabel,
  rightVersionLabel,
  notice,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  itemTitle: string;
  leftVersion: StorytellerVersionCompareEntry | null;
  rightVersion: StorytellerVersionCompareEntry | null;
  /** proposal review 可覆寫標題與左右語意，預設仍維持編輯歷史的版本比對文案。 */
  dialogTitle?: string;
  leftVersionLabel?: string;
  rightVersionLabel?: string;
  notice?: ReactNode;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const resolvedLeftLabel = leftVersionLabel ?? t("writer:editor.diff.oldVersion");
  const resolvedRightLabel = rightVersionLabel ?? t("writer:editor.diff.newVersion");
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const diffSections = useMemo(() => {
    if (!leftVersion || !rightVersion) {
      return [];
    }
    const sections = [
      {
        key: "title",
        title: t("writer:editor.diff.titleField"),
        lines: buildCustomLineDiff(leftVersion.title, rightVersion.title),
      },
      ...(leftVersion.summary !== undefined &&
      rightVersion.summary !== undefined
        ? [
            {
              key: "summary",
              title: t("writer:editor.diff.summaryField"),
              lines: buildCustomLineDiff(
                leftVersion.summary,
                rightVersion.summary,
              ),
            },
          ]
        : []),
      ...(leftVersion.extraFields ?? []).map((field) => ({
        key: field.key,
        title: field.label,
        lines: buildCustomLineDiff(
          field.value,
          rightVersion.extraFields?.find((item) => item.key === field.key)
            ?.value ?? "",
        ),
      })),
      {
        key: "content",
        title: leftVersion.contentLabel ?? t("writer:editor.diff.contentField"),
        // 濾掉 marker/align/comment 屬性再比對——這個對話框是純文字 diff（不會經過
        // 我們的解析器渲染），不濾掉的話使用者會直接看到 `⟦uuid⟧...⟦/uuid⟧` 這種
        // 內部語法，且無關的屬性異動會被誤判成內容變更。
        lines: buildCustomLineDiff(
          stripMarkerForDiffContent(leftVersion.content),
          stripMarkerForDiffContent(rightVersion.content),
        ),
      },
    ];
    if (leftVersion.includeFootnotes ?? true) {
      sections.push({
        key: "footnotes",
        title: t("writer:editor.diff.footnotesField"),
        lines: buildCustomLineDiff(
          extractFootnoteNotesForDiff(leftVersion.content).join("\n"),
          extractFootnoteNotesForDiff(rightVersion.content).join("\n"),
        ),
      });
    }
    return sections;
  }, [leftVersion, rightVersion, t]);

  const changedCount = diffSections.reduce(
    (total, section) =>
      total + section.lines.filter((line) => line.state !== "same").length,
    0,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      fullScreen={fullScreen}
      maxWidth="lg"
      scroll="paper"
    >
      <DialogTitle>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h6" fontWeight={800} noWrap>
              {dialogTitle ?? t("writer:editor.diff.compareTitle", { title: itemTitle })}
            </Typography>
            {diffSections.length > 0 && (
              <Chip
                size="small"
                color={changedCount > 0 ? "warning" : "default"}
                label={
                  changedCount > 0
                    ? t("writer:editor.diff.differenceCount", { count: changedCount })
                    : t("writer:editor.diff.noDifference")
                }
                sx={{ alignSelf: "flex-start" }}
              />
            )}
          </Stack>
          <IconButton onClick={onClose} aria-label={t("writer:editor.diff.closeCompare")}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {leftVersion && rightVersion && (
          <Stack spacing={3}>
            {/* 兩個版本各自的來源／建立時間放在最上面，不用點開任何一個 diff
                區塊（尤其是預設收合的「無變更」區塊）才能知道在比對哪兩個版本。 */}
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 1, sm: 2 }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <ArrowBackIcon fontSize="small" color="disabled" />
                <Typography variant="body2" color="text.secondary">
                  {resolvedLeftLabel}
                </Typography>
                <Chip size="small" label={leftVersion.source} />
                <Typography variant="body2" color="text.secondary">
                  {formatStorytellerDate(leftVersion.createdAt, i18n.resolvedLanguage)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  {resolvedRightLabel}
                </Typography>
                <Chip size="small" label={rightVersion.source} />
                <Typography variant="body2" color="text.secondary">
                  {formatStorytellerDate(rightVersion.createdAt, i18n.resolvedLanguage)}
                </Typography>
                <ArrowForwardIcon fontSize="small" color="disabled" />
              </Stack>
            </Stack>
            {notice}
            <CustomDiffLegend />
            {diffSections.map((section) => (
              <CustomDiffSection
                key={section.key}
                title={section.title}
                lines={section.lines}
                leftTitle={resolvedLeftLabel}
                rightTitle={resolvedRightLabel}
                leftMetadataLabels={[
                  leftVersion.source,
                  formatStorytellerDate(leftVersion.createdAt, i18n.resolvedLanguage),
                ]}
                rightMetadataLabels={[
                  rightVersion.source,
                  formatStorytellerDate(rightVersion.createdAt, i18n.resolvedLanguage),
                ]}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
      {actions && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
}
