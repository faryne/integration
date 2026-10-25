import { Box, Button, Paper, Typography } from "@mui/material";
import DesktopWindowsOutlinedIcon from "@mui/icons-material/DesktopWindowsOutlined";
import { Link } from "react-router-dom";

/** 手機開電視牆：不建立任何播放器，只提示改用電腦 */
export function WallUnsupported() {
  return (
    <Paper
      variant={"outlined"}
      sx={{ maxWidth: 480, mx: "auto", px: 2.5, py: 3.5, textAlign: "center" }}
    >
      <Box
        sx={{
          width: 56,
          height: 56,
          mx: "auto",
          mb: 1.75,
          borderRadius: "50%",
          bgcolor: "action.hover",
          color: "text.secondary",
          display: "grid",
          placeItems: "center",
        }}
      >
        <DesktopWindowsOutlinedIcon />
      </Box>
      <Typography variant={"h6"} fontWeight={700} sx={{ mb: 1 }}>
        電視牆不支援手機
      </Typography>
      <Typography color={"text.secondary"} sx={{ mb: 2.5, lineHeight: 1.7 }}>
        電視牆會同時播放多部直播，需要電腦的大螢幕，請改用電腦開啟。
      </Typography>
      <Button variant={"contained"} component={Link} to={"/data/vtubers"}>
        回直播行事曆
      </Button>
    </Paper>
  );
}
