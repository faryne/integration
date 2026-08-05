import CloseIcon from "@mui/icons-material/Close";
import {
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMemo } from "react";
import { buildCustomLineDiff } from "@/components/common/customDiff.ts";
import { CustomDiffLegend } from "@/components/common/CustomDiffLegend.tsx";
import { CustomDiffSection } from "@/components/common/CustomDiffSection.tsx";
import { formatStorytellerDate } from "@/data/storyteller.ts";
import {
  extractFootnoteNotesForDiff,
  stripMarkerForDiffContent,
} from "@/pages/storyteller/wysiwygCore/parser.ts";

// 故事有摘要、設定集沒有，summary 留 undefined 就代表這個類型不比對摘要——
// 兩邊呼叫端（StoryEditor／LoreEditor）都直接把 apiStoryVersions／apiLoreVersions
// 裡已經載入好的版本物件（含完整 content）原樣傳進來，不用另外發請求，跟原本
// 獨立頁面（StoryDiffCompare／LoreDiffCompare）不一樣，那邊沒有預先載入的資料
// 可以借，才需要自己重新 fetch 兩個版本。
export interface StorytellerVersionCompareEntry {
  title: string;
  summary?: string;
  content: string;
  source: string;
  createdAt: string;
}

export function StorytellerVersionCompareDialog({
  open,
  onClose,
  itemTitle,
  leftVersion,
  rightVersion,
}: {
  open: boolean;
  onClose: () => void;
  itemTitle: string;
  leftVersion: StorytellerVersionCompareEntry | null;
  rightVersion: StorytellerVersionCompareEntry | null;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const diffSections = useMemo(() => {
    if (!leftVersion || !rightVersion) {
      return [];
    }
    return [
      {
        key: "title",
        title: "標題",
        lines: buildCustomLineDiff(leftVersion.title, rightVersion.title),
      },
      ...(leftVersion.summary !== undefined &&
      rightVersion.summary !== undefined
        ? [
            {
              key: "summary",
              title: "摘要",
              lines: buildCustomLineDiff(
                leftVersion.summary,
                rightVersion.summary,
              ),
            },
          ]
        : []),
      {
        key: "content",
        title: "內容",
        // 濾掉 marker/align/comment 屬性再比對——這個對話框是純文字 diff（不會經過
        // 我們的解析器渲染），不濾掉的話使用者會直接看到 `⟦uuid⟧...⟦/uuid⟧` 這種
        // 內部語法，且無關的屬性異動會被誤判成內容變更。
        lines: buildCustomLineDiff(
          stripMarkerForDiffContent(leftVersion.content),
          stripMarkerForDiffContent(rightVersion.content),
        ),
      },
      {
        key: "footnotes",
        title: "腳注",
        lines: buildCustomLineDiff(
          extractFootnoteNotesForDiff(leftVersion.content).join("\n"),
          extractFootnoteNotesForDiff(rightVersion.content).join("\n"),
        ),
      },
    ];
  }, [leftVersion, rightVersion]);

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
              {itemTitle} 版本比對
            </Typography>
            {diffSections.length > 0 && (
              <Chip
                size="small"
                color={changedCount > 0 ? "warning" : "default"}
                label={
                  changedCount > 0 ? `${changedCount} 行差異` : "兩版本無差異"
                }
                sx={{ alignSelf: "flex-start" }}
              />
            )}
          </Stack>
          <IconButton onClick={onClose} aria-label="關閉版本比對">
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
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  舊版本
                </Typography>
                <Chip size="small" label={leftVersion.source} />
                <Typography variant="body2" color="text.secondary">
                  {formatStorytellerDate(leftVersion.createdAt)}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  新版本
                </Typography>
                <Chip size="small" label={rightVersion.source} />
                <Typography variant="body2" color="text.secondary">
                  {formatStorytellerDate(rightVersion.createdAt)}
                </Typography>
              </Stack>
            </Stack>
            <CustomDiffLegend />
            {diffSections.map((section) => (
              <CustomDiffSection
                key={section.key}
                title={section.title}
                lines={section.lines}
                leftTitle="舊版本"
                rightTitle="新版本"
                leftMetadataLabels={[
                  leftVersion.source,
                  formatStorytellerDate(leftVersion.createdAt),
                ]}
                rightMetadataLabels={[
                  rightVersion.source,
                  formatStorytellerDate(rightVersion.createdAt),
                ]}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}
