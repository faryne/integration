import {
  AppBar,
  Box,
  Button,
  Container,
  Divider,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { Link as RouterLink, Outlet } from "react-router-dom";

import { FaryneLogo } from "@/components/common/FaryneLogo.tsx";

const navigation = [
  { title: "全部影片", href: "/" },
  { title: "最新影片", href: "/?tab=recent" },
  { title: "品牌", href: "/?tab=brands" },
];

export function GalgameLayout() {
  return (
    <Stack minHeight="100vh">
      <AppBar position="sticky" elevation={0}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: { xs: 1, sm: 2 } }}>
            <Stack
              component={RouterLink}
              to="/"
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                color: "inherit",
                textDecoration: "none",
                mr: "auto",
                minWidth: 0,
              }}
            >
              <FaryneLogo width={36} alt="Galgame TV" />
              <Typography variant="h6" component="span" fontWeight={800} noWrap>
                Galgame TV
              </Typography>
            </Stack>

            {navigation.map((item) => (
              <Button
                key={item.title}
                component={RouterLink}
                to={item.href}
                color="inherit"
                size="small"
              >
                {item.title}
              </Button>
            ))}
          </Toolbar>
        </Container>
      </AppBar>

      <Container component="main" maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Outlet />
      </Container>

      <Container component="footer" maxWidth="lg">
        <Divider />
        <Box sx={{ py: 2, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            Galgame TV by{" "}
            <Typography
              component="a"
              href="https://faryne.dev/"
              variant="body2"
              color="inherit"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textDecoration: "underline" }}
            >
              faryne.dev
            </Typography>
          </Typography>
        </Box>
      </Container>
    </Stack>
  );
}
