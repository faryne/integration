import { Link as RouterLink } from "react-router-dom";
import { Button, Paper, Stack, Typography } from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";

/** 送出審核後的畫面：顯示提交單編號（女優上稿、影片修改共用） */
export function SubmissionDone({
  id,
  backTo,
  backLabel,
  onAgain,
  againLabel,
}: {
  id: number;
  backTo: string;
  backLabel: string;
  /** 有給才顯示「再送一張」的按鈕（新增女優用） */
  onAgain?: () => void;
  againLabel?: string;
}) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 5, textAlign: "center" }}>
      <MarkEmailReadOutlinedIcon color="primary" sx={{ fontSize: 48 }} />
      <Typography fontWeight={900} variant="h5" sx={{ mt: 1 }}>
        已送出審核
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        提交單編號 <b>#{id}</b>
      </Typography>
      <Stack
        direction="row"
        spacing={1}
        sx={{ justifyContent: "center", mt: 3 }}
      >
        {onAgain && (
          <Button onClick={onAgain} variant="outlined">
            {againLabel}
          </Button>
        )}
        <Button component={RouterLink} to={backTo} variant="contained">
          {backLabel}
        </Button>
      </Stack>
    </Paper>
  );
}
