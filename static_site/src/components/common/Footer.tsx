import { Box, Divider, Stack, Typography } from "@mui/material";
import { FooterNavigation } from "./FooterNavigation";
import { SocialLinks } from "./SocialLinks";

export function Footer() {
  return (
    <footer>
      <Divider textAlign={"left"} />
      <Stack
        direction={{ xs: "column", lg: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", lg: "flex-start" }}
        spacing={3}
        sx={{ py: 2 }}
      >
        <Stack spacing={0.75} sx={{ flexShrink: 0, minWidth: 190 }}>
          <Typography variant={"body2"} color="text.secondary">
            Powered By Faryne |{" "}
            <Typography
              component={"a"}
              variant={"body2"}
              href={"https://faryne.dev/"}
              sx={{ color: "inherit", textDecoration: "underline" }}
            >
              faryne.dev
            </Typography>
          </Typography>
          <SocialLinks />
        </Stack>
        <Box sx={{ flexGrow: 1, width: "100%" }}>
          <FooterNavigation />
        </Box>
      </Stack>
    </footer>
  );
}
