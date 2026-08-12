import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import type {
  CustomDiffLine,
  CustomDiffState,
} from "@/components/common/customDiff.ts";

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

export function CustomDiffSection({
  leftMetadataLabels = [],
  leftTitle = "舊版本",
  lines,
  rightMetadataLabels = [],
  rightTitle = "新版本",
  title,
}: CustomDiffSectionProps) {
  const unchanged = lines.every((line) => line.state === "same");

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
              {/* 左右 cell 放在同一個 row，讓 wrapped text 撐出的列高能同步到另一側。 */}
              {lines.map((line) => (
                <Box
                  key={line.index}
                  component="span"
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  }}
                >
                  <DiffCell line={line} side="left" />
                  <DiffCell line={line} side="right" />
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
