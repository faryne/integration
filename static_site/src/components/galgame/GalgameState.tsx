import { Alert, CircularProgress, Paper, Stack, Typography } from "@mui/material";

interface Props {
  message: string;
  loading?: boolean;
  severity?: "info" | "error";
}

export function GalgameState({
  message,
  loading = false,
  severity = "info",
}: Props) {
  if (!loading) {
    return <Alert severity={severity}>{message}</Alert>;
  }

  return (
    <Paper variant="outlined" sx={{ p: 4 }}>
      <Stack alignItems="center" spacing={2}>
        <CircularProgress size={32} />
        <Typography color="text.secondary">{message}</Typography>
      </Stack>
    </Paper>
  );
}
