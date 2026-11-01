import {
  Box,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value?: ReactNode; // 標題下的大數字
  delta?: ReactNode; // 大數字旁的增減
  sub?: ReactNode; // 大數字下一行的補充（平均、最高）
  action?: ReactNode; // 右上角，通常是 StatToggle
  children?: ReactNode;
}

/** 統計分頁每張卡片的外框與標題列 */
export function StatCard({
  label,
  value,
  delta,
  sub,
  action,
  children,
}: StatCardProps) {
  return (
    <Paper variant={"outlined"} sx={{ px: 2, pt: 1.75, pb: 1 }}>
      <Stack
        direction={"row"}
        flexWrap={"wrap"}
        gap={1}
        alignItems={"flex-end"}
        justifyContent={"space-between"}
        sx={{ pb: children ? 0 : 0.75 }}
      >
        <Box>
          <Typography variant={"body2"} color={"text.secondary"}>
            {label}
          </Typography>
          {value != null && (
            <Stack direction={"row"} spacing={1} alignItems={"baseline"}>
              <Typography variant={"h5"} fontWeight={800}>
                {value}
              </Typography>
              {delta}
            </Stack>
          )}
          {sub && (
            <Typography variant={"body2"} color={"text.secondary"}>
              {sub}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/** 卡片右上角的切換鈕 */
export function StatToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}) {
  return (
    <ToggleButtonGroup
      size={"small"}
      exclusive
      value={value}
      onChange={(_, next: T | null) => next && onChange(next)}
    >
      {options.map(([key, label]) => (
        <ToggleButton key={key} value={key} sx={{ px: 1.25 }}>
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

/** 卡片內沒有圖可畫時的置中文字 */
export function StatEmpty({ children }: { children: ReactNode }) {
  return (
    <Typography color={"text.secondary"} textAlign={"center"} sx={{ py: 3 }}>
      {children}
    </Typography>
  );
}
