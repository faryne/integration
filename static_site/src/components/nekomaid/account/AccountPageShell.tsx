import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Breadcrumbs, Link, Paper, Stack, Typography } from "@mui/material";

import { nekomaidPath } from "@/helpers/nekomaid.ts";
import { useTitle } from "@/helpers/title.tsx";

/** 帳號相關頁面（登入、註冊、忘記密碼、信件連結）的共用外框：麵包屑＋置中的卡片 */
export function AccountPageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  useTitle(title);
  return (
    <Stack spacing={2} sx={{ textAlign: "left" }}>
      <Breadcrumbs aria-label="帳號頁麵包屑" sx={{ fontSize: 14 }}>
        <Link component={RouterLink} to={nekomaidPath()} underline="hover">
          難以名狀的抓圖器
        </Link>
        <Typography color="text.primary" fontWeight={800}>
          {title}
        </Typography>
      </Breadcrumbs>
      <Paper
        // border-box：width 100% 已含內距，手機上才不會撐出外層
        sx={{
          boxSizing: "border-box",
          maxWidth: 420,
          mx: "auto",
          p: 3,
          width: "100%",
        }}
        variant="outlined"
      >
        <Stack spacing={2}>
          <Typography
            component="h1"
            fontWeight={900}
            sx={{ textAlign: "center" }}
            variant="h5"
          >
            {title}
          </Typography>
          {children}
        </Stack>
      </Paper>
    </Stack>
  );
}
