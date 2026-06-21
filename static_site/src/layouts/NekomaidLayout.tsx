import { Box, Button, Stack, Typography } from "@mui/material";
import AutoAwesomeMosaicIcon from "@mui/icons-material/AutoAwesomeMosaic";
import HomeIcon from "@mui/icons-material/Home";
import { Link as RouterLink, Outlet } from "react-router-dom";
import "@/styles/common.css";
import { isNekomaidSite, nekomaidPath } from "@/helpers/nekomaid.ts";

export function NekomaidLayout() {
  const standaloneNekomaid = isNekomaidSite();

  return (
    <Box
      sx={{
        left: "50%",
        marginLeft: "-50vw",
        marginRight: "-50vw",
        marginTop: 0,
        minHeight: "100vh",
        position: "relative",
        right: "50%",
        width: "100vw",
        background: "#fff",
      }}
    >
      <Box
        component="header"
        sx={{
          background:
            "radial-gradient(circle at 10% 0%, rgba(245, 158, 11, 0.26), transparent 32%), radial-gradient(circle at 88% 0%, rgba(14, 165, 233, 0.18), transparent 28%), linear-gradient(110deg, #33251d 0%, #111827 48%, #0f2941 100%)",
          borderBottom: "1px solid rgba(15, 23, 42, 0.16)",
          color: "#f8fafc",
          px: { xs: 2, md: 4 },
          py: { xs: 2, md: 2.5 },
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          alignItems={{ xs: "stretch", sm: "center" }}
          justifyContent="space-between"
          spacing={2}
          sx={{ width: "100%" }}
        >
          <Stack
            component={RouterLink}
            to={nekomaidPath()}
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              color: "inherit",
              textDecoration: "none",
              width: "fit-content",
            }}
          >
            <Box
              sx={{
                alignItems: "center",
                bgcolor: "rgba(251, 191, 36, 0.16)",
                border: "1px solid rgba(251, 191, 36, 0.34)",
                borderRadius: 2,
                color: "#fde68a",
                display: "flex",
                height: 42,
                justifyContent: "center",
                width: 42,
              }}
            >
              <AutoAwesomeMosaicIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="p"
                sx={{ fontWeight: 950, lineHeight: 1.1 }}
              >
                難以名狀的抓圖器
              </Typography>
            </Box>
          </Stack>

          {!standaloneNekomaid && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                component={RouterLink}
                to="/"
                size="small"
                startIcon={<HomeIcon fontSize="small" />}
                sx={{
                  borderColor: "rgba(255,255,255,0.28)",
                  color: "#f8fafc",
                  ml: { sm: 1 },
                  "&:hover": {
                    borderColor: "rgba(255,255,255,0.54)",
                    bgcolor: "rgba(255,255,255,0.08)",
                  },
                }}
                variant="outlined"
              >
                回 faryne.dev
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>

      <Box
        component="main"
        sx={{
          background: "#fff",
          borderTop: "1px solid rgba(15, 23, 42, 0.08)",
          px: { xs: 2, md: 4 },
          py: { xs: 3, md: 4 },
        }}
      >
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          color: "#64748b",
          px: { xs: 2, md: 4 },
          py: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="body2">
          難以名狀的抓圖器 by{" "}
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
    </Box>
  );
}
