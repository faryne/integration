import { Box, Container, Typography, Link, Stack } from "@mui/material";
import { FaryneLogo } from "./FaryneLogo";

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
            ? "#F0E8F5"   // 與 Header 同色系，再淡一點的薰衣草紫
            : "#252030",  // Dark mode 深紫灰
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={1}>
            <FaryneLogo width={26} />
            <Typography variant="body2" color="text.secondary">
              Powered By Faryne |{" "}
              <Link color="inherit" href="https://faryne.dev/">
                faryne.dev
              </Link>
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
