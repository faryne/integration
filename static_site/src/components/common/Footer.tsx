import { Box, Divider, Stack, Typography } from "@mui/material";
import { FooterNavigation } from "./FooterNavigation";

export function Footer() {
  return (
    <footer>
      <Divider textAlign={"left"} />
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        spacing={2}
        sx={{ py: 1.5 }}
      >
        <Box sx={{ flexShrink: 0 }}>
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
        </Box>
        <Box sx={{ flexGrow: 1, maxWidth: { md: 720 } }}>
          <FooterNavigation />
        </Box>
      </Stack>
    </footer>
  );
}
