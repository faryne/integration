import { Button, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface EsCursorPaginationProps {
  from: number;
  to: number;
  total: number;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  perPage?: number;
  sx?: SxProps<Theme>;
}

export function EsCursorPagination({
  from,
  to,
  total,
  hasPrevious = false,
  hasNext = false,
  onPrevious,
  onNext,
  perPage = 30,
  sx,
}: EsCursorPaginationProps) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.5}
      alignItems="center"
      justifyContent="center"
      sx={sx}
    >
      <Button variant="outlined" disabled={!hasPrevious} onClick={onPrevious}>
        上一頁
      </Button>
      <Typography variant="body2" color="text.secondary">
        目前讀取第 {from.toLocaleString("zh-TW")} / &nbsp;
        {to.toLocaleString("zh-TW")} 筆資料
      </Typography>
      <Button variant="outlined" disabled={!hasNext} onClick={onNext}>
        下一頁
      </Button>
      <Typography variant="body2" color="text.secondary">
        總共 {total.toLocaleString("zh-TW")} 筆，{Math.ceil(total / perPage)} 頁
      </Typography>
    </Stack>
  );
}
