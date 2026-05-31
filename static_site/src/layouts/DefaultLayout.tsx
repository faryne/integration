import { Header } from "@/components/common/Header.tsx";
import { Footer } from "@/components/common/Footer.tsx";
import { Outlet } from "react-router-dom";
import type { FC, ReactNode } from "react";
import "@/styles/common.css";
import { Container, Stack } from "@mui/material";

export interface IDefaultLayout {
  fullWidth?: boolean;
}

export const DefaultLayout: FC<{ children?: ReactNode } & IDefaultLayout> = (
  props: IDefaultLayout,
) => {
  return (
    <Container
      sx={{ minWidth: props.fullWidth ? "100% !important" : "1280px" }}
    >
      <Stack direction={"column"}>
        <Header fullWidth={props.fullWidth} />
        <main>
          <Outlet />
        </main>
        <Footer />
      </Stack>
    </Container>
  );
};
