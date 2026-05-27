import { Box, Container, Typography, Link, Stack } from "@mui/material";

export function ModernFooter() {
  return (
    <Box
      component="footer"
      sx={{
        py: 3,
        px: 2,
        mt: "auto",
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? theme.palette.grey[200]
            : theme.palette.grey[800],
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography variant="body2" color="text.secondary">
            Powered By Faryne |{" "}
            <Link color="inherit" href="https://faryne.dev/">
              faryne.dev
            </Link>
          </Typography>
        </Stack>
      </Container>
    </Box>
  );
}
