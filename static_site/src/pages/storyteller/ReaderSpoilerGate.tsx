import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { Box, Button, Chip, Link, Stack, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { LORE_DEPENDENCY_TYPE_LABEL } from "./readerModel.ts";
import { ReaderProgressBadge } from "./ReaderProgressBadge.tsx";
import type { ReaderProgress } from "./readingRecordStore.ts";

export interface ReaderSpoilerDependency {
  key: string;
  type: "story" | "lore";
  title: string;
  href: string;
  progress?: ReaderProgress;
}

// 劇透設定的確認卡片：列出還沒讀完的內容（各自可以點過去讀），讀者也可以選擇直接看。
// 設定頁、設定摘要小卡、右側設定面板共用；compact 給小卡用，少一點留白。
export function ReaderSpoilerGate({
  dependencies,
  onConfirm,
  onNavigate,
  compact = false,
}: {
  dependencies: ReaderSpoilerDependency[];
  onConfirm: () => void;
  // 點依賴連結時要先做的事（例如關掉小卡）
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Box
      sx={{
        p: compact ? 1.5 : { xs: 2, sm: 3 },
        border: 2,
        borderColor: "warning.main",
        borderRadius: 1,
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? "rgba(237, 108, 2, 0.08)"
            : "rgba(237, 108, 2, 0.06)",
      }}
    >
      <Stack spacing={compact ? 1 : 1.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReportProblemOutlinedIcon color="warning" fontSize="small" />
          <Typography fontWeight={800}>這則設定含有還沒讀到的劇情</Typography>
        </Stack>
        {dependencies.length > 0 ? (
          <>
            <Typography variant="body2" color="text.secondary">
              作者建議先讀完以下內容：
            </Typography>
            <Stack spacing={0.75}>
              {dependencies.map((dependency) => (
                <Stack
                  key={dependency.key}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Stack
                    direction="row"
                    spacing={0.75}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      label={LORE_DEPENDENCY_TYPE_LABEL[dependency.type]}
                      sx={{ height: 20, borderRadius: 1, flexShrink: 0 }}
                    />
                    <Link
                      component={RouterLink}
                      to={dependency.href}
                      onClick={onNavigate}
                      fontWeight={700}
                      underline="hover"
                    >
                      {dependency.title}
                    </Link>
                  </Stack>
                  {dependency.progress ? (
                    <ReaderProgressBadge progress={dependency.progress} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      尚未閱讀
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            作者把這則設定標成含劇透，確認後再看。
          </Typography>
        )}
        <Box>
          <Button
            variant="contained"
            color="warning"
            size={compact ? "small" : "medium"}
            onClick={onConfirm}
          >
            我了解，繼續閱讀
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
