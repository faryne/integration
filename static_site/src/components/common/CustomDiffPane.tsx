import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import type { CustomDiffLine, CustomDiffState } from "@/components/common/customDiff.ts";

interface CustomDiffPaneProps {
  lines: CustomDiffLine[];
  metadataLabels?: string[];
  side: "left" | "right";
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

export function CustomDiffPane({
  lines,
  metadataLabels = [],
  side,
  title,
}: CustomDiffPaneProps) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, overflow: "hidden" }}>
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
        {/* 共用 diff 呈現，讓故事與設定集的版本比對維持一致視覺。 */}
        {lines.map((line) => (
          <Box
            key={`${side}-${line.index}`}
            component="span"
            sx={{
              display: "grid",
              gridTemplateColumns: "48px minmax(0, 1fr)",
              px: 1.5,
              py: 0.25,
              ...lineSx(line.state, side),
            }}
          >
            <Box
              component="span"
              sx={{ color: "text.secondary", userSelect: "none" }}
            >
              {line.index}
            </Box>
            <Box component="span">
              {side === "left" ? line.left : line.right || " "}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
