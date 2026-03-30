import { CircularProgress, Typography, Box } from "@mui/material";

export function CustomLoading() {
  return (
    <Box sx={{ textAlign: "center" }}>
      <CircularProgress color="success" sx={{ float: "left" }} />
      <Typography variant={"h4"}>載入中</Typography>
    </Box>
  );
}
