import { Stack, Typography } from "@mui/material";

import { SocialLinks } from "@/components/common/SocialLinks.tsx";

export interface IndependentFooterProps {
  service_name: string; // 服務名稱
}

export default function IndependentFooter(props: IndependentFooterProps) {
  return (
    <Stack
      spacing={0.75}
      alignItems="center"
      sx={{
        width: "100%",
        py: 2,
        textAlign: "center",
        "& [aria-label='social links']": {
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "100%",
          rowGap: 0.5,
        },
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: "100%" }}
      >
        {props.service_name} powered By Faryne |{" "}
        <Typography
          component="a"
          variant="body2"
          href="https://faryne.dev/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "underline" }}
        >
          faryne.dev
        </Typography>
      </Typography>
      <SocialLinks />
    </Stack>
  );
}
