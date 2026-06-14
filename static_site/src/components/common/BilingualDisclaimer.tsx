import type { ReactNode } from "react";

import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Container, Typography } from "@mui/material";

interface BilingualDisclaimerProps {
  title?: ReactNode;
  chinese: ReactNode;
  english: ReactNode;
}

export function BilingualDisclaimer({
  title = "警語與免責聲明 / Disclaimer",
  chinese,
  english,
}: BilingualDisclaimerProps) {
  return (
    <Box
      component="footer"
      sx={{ mt: 8, pb: 4, bgcolor: "background.default" }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            color: "text.secondary",
          }}
        >
          <WarningAmberIcon
            fontSize="small"
            sx={{ mt: 0.3, color: "warning.main" }}
          />
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: "bold", mb: 1, color: "text.primary" }}
            >
              {title}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{ lineHeight: 1.6, mb: 1.5 }}
            >
              {chinese}
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{ lineHeight: 1.6, fontStyle: "italic" }}
            >
              {english}
            </Typography>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
