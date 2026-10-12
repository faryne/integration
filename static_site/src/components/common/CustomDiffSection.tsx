import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  ButtonBase,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
// 網站與 SteamLoom Writer 共用；Writer 透過 alias 直接 import，這支檔案只能用相對路徑 import。
import {
  collapseUnchangedLines,
  type CustomDiffLine,
  type CustomDiffState,
} from "./customDiff.ts";

interface CustomDiffSectionProps {
  leftMetadataLabels?: string[];
  leftTitle?: string;
  lines: CustomDiffLine[];
  rightMetadataLabels?: string[];
  rightTitle?: string;
  title: string;
}

function lineSx(state: CustomDiffState, side: "left" | "right") {
  if (state === "same") {
    return { bgcolor: "transparent" };
  }
  if (state === "added") {
    return side === "right"
      ? { bgcolor: "success.light", color: "success.contrastText" }
      : { bgcolor: "action.hover", color: "text.secondary" };
  }
  if (state === "removed") {
    return side === "left"
      ? { bgcolor: "error.light", color: "error.contrastText" }
      : { bgcolor: "action.hover", color: "text.secondary" };
  }
  return { bgcolor: "warning.light" };
}

function lineNumber(line: CustomDiffLine, side: "left" | "right") {
  return side === "left" ? line.leftIndex : line.rightIndex;
}

function DiffHeader({
  metadataLabels,
  title,
}: {
  metadataLabels: string[];
  title: string;
}) {
  return (
    <Stack spacing={1} sx={{ p: 2, bgcolor: "background.default" }}>
      <Typography variant="h6" fontWeight={800}>
        {title}
      </Typography>
      {metadataLabels.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {metadataLabels.map((label) => (
            <Chip key={label} size="small" label={label} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function DiffCell({
  line,
  side,
}: {
  line: CustomDiffLine;
  side: "left" | "right";
}) {
  return (
    <Box
      component="span"
      sx={{
        display: "grid",
        gridTemplateColumns: "48px minmax(0, 1fr)",
        alignSelf: "stretch",
        px: 1.5,
        py: 0.25,
        ...lineSx(line.state, side),
      }}
    >
      <Box
        component="span"
        sx={{ color: "text.secondary", userSelect: "none" }}
      >
        {lineNumber(line, side) ?? " "}
      </Box>
      <Box component="span">
        {side === "left" ? line.left || " " : line.right || " "}
      </Box>
    </Box>
  );
}

// 左右 cell 放在同一個 row，讓 wrapped text 撐出的列高能同步到另一側。
function DiffRow({ line }: { line: CustomDiffLine }) {
  return (
    <Box
      component="span"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
      }}
    >
      <DiffCell line={line} side="left" />
      <DiffCell line={line} side="right" />
    </Box>
  );
}

// 收合／展開未變更段落的切換列，橫跨左右兩欄：收合時點了展開，展開後放在該段最上方，點了收回
function DiffGap({
  count,
  expanded,
  onToggle,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <ButtonBase
      onClick={onToggle}
      sx={{
        display: "flex",
        width: "100%",
        gap: 1,
        py: 0.5,
        color: "text.secondary",
        bgcolor: "action.hover",
        fontFamily: "inherit",
        fontSize: 12,
        "&:hover": { color: "primary.main" },
      }}
    >
      {expanded ? (
        <UnfoldLessIcon fontSize="small" />
      ) : (
        <UnfoldMoreIcon fontSize="small" />
      )}
      {expanded ? "收縮" : "展開"} {count} 行未變更的內容
    </ButtonBase>
  );
}

export function CustomDiffSection({
  leftMetadataLabels = [],
  leftTitle = "舊版本",
  lines,
  rightMetadataLabels = [],
  rightTitle = "新版本",
  title,
}: CustomDiffSectionProps) {
  const unchanged = lines.every((line) => line.state === "same");
  const rows = useMemo(() => collapseUnchangedLines(lines), [lines]);
  // 已展開的收合段（以收合段第一行的 index 當 id）
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(
    () => new Set(),
  );

  return (
    <Accordion defaultExpanded={!unchanged} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography fontWeight={800}>{title}</Typography>
          <Chip
            size="small"
            label={unchanged ? "無變更" : "有變動"}
            color={unchanged ? "default" : "warning"}
          />
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {unchanged ? (
          <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
            <Typography color="text.secondary">無變更</Typography>
          </Paper>
        ) : (
          <Paper
            variant="outlined"
            sx={{ borderRadius: 1, overflow: "hidden" }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              }}
            >
              <DiffHeader
                title={leftTitle}
                metadataLabels={leftMetadataLabels}
              />
              <DiffHeader
                title={rightTitle}
                metadataLabels={rightMetadataLabels}
              />
            </Box>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 0,
                overflowX: "auto",
                fontFamily:
                  '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
                fontSize: 13,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {/* 未變更的長段落收合成一列，點了才展開（見 collapseUnchangedLines）。 */}
              {rows.flatMap((row) => {
                if (row.kind === "line") {
                  return [<DiffRow key={row.line.index} line={row.line} />];
                }
                const expanded = expandedGaps.has(row.id);
                const toggle = (
                  <DiffGap
                    key={`gap-${row.id}`}
                    count={row.hiddenCount}
                    expanded={expanded}
                    onToggle={() =>
                      setExpandedGaps((prev) => {
                        const next = new Set(prev);
                        if (expanded) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      })
                    }
                  />
                );
                return expanded
                  ? [
                      toggle,
                      ...row.hidden.map((line) => (
                        <DiffRow key={line.index} line={line} />
                      )),
                    ]
                  : [toggle];
              })}
            </Box>
          </Paper>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
