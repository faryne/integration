import { Link as RouterLink } from "react-router-dom";
import { Button, Paper, Stack, Typography } from "@mui/material";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";

/** 送出審核後的畫面：顯示提交單編號 */
export function ActressSubmissionDone({
  id,
  backTo,
  onAgain,
}: {
  id: number;
  backTo: string;
  onAgain?: () => void;
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
            再新增一位
          </Button>
        )}
        <Button component={RouterLink} to={backTo} variant="contained">
          回到女優頁面
        </Button>
      </Stack>
    </Paper>
  );
}
