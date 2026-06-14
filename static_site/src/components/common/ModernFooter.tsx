import { Box, Container, Link, Stack, Typography } from "@mui/material";
import { FaryneLogo } from "./FaryneLogo";
import { FooterNavigation } from "./FooterNavigation";
import { SocialLinks } from "./SocialLinks";

export function ModernFooter() {
  return (
    <Box
      component="footer"
      sx={{
        flexShrink: 0,
        width: "100%",
        py: 3,
        px: 2,
        backgroundColor: (theme) =>
          theme.palette.mode === "light"
            ? "#F0E8F5" // 與 Header 同色系，再淡一點的薰衣草紫
            : "#252030", // Dark mode 深紫灰
      }}
    >
      <Container maxWidth="lg">
        <Stack
          direction={{ xs: "column", lg: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", lg: "flex-start" }}
          spacing={3}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={1}
          >
            <FaryneLogo width={26} />
            <Stack spacing={0.75}>
              <Typography variant="body2" color="text.secondary">
                Powered By Faryne |{" "}
                <Link color="inherit" href="https://faryne.dev/">
                  faryne.dev
                </Link>
              </Typography>
              <SocialLinks />
            </Stack>
          </Stack>
          <Box sx={{ flexGrow: 1, width: "100%" }}>
            <FooterNavigation />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
