import { ModernHeader } from "@/components/common/ModernHeader.tsx";
import { ModernFooter } from "@/components/common/ModernFooter.tsx";
import { Outlet } from "react-router-dom";
import type { FC, ReactNode } from "react";
import "@/styles/common.css";
import { Box, Container } from "@mui/material";

export interface IModernLayout {
  fullWidth?: boolean;
}

export const ModernLayout: FC<{ children?: ReactNode } & IModernLayout> = (
  props: IModernLayout,
) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        m: 0,
      }}
    >
      <ModernHeader />
      <Box
        component="main"
        sx={{
          flex: "1 0 auto",
          py: 3,
        }}
      >
        <Container
          sx={{
            minWidth: props.fullWidth
              ? "100% !important"
              : { xs: "100%", md: "1200px" },
            maxWidth: props.fullWidth ? "100% !important" : "lg",
          }}
        >
          <Outlet />
        </Container>
      </Box>
      <ModernFooter />
    </Box>
  );
};
