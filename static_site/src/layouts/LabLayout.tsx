import { Link, Outlet } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Link as MuiLink,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { useState, type FC, type MouseEvent } from "react";
import BiotechIcon from "@mui/icons-material/Biotech";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { FaryneLogo } from "@/components/common/FaryneLogo";
import { FooterNavigation } from "@/components/common/FooterNavigation";
import { SocialLinks } from "@/components/common/SocialLinks";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation";
import { type LayoutDropMenu, type LayoutMenuItem } from "@/types/layout";

export const LabLayout: FC = () => {
  const [openedMenu, setOpenedMenu] = useState<LayoutDropMenu | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleMenuOpen = (
    menu: LayoutDropMenu,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setOpenedMenu(menu);
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setOpenedMenu(null);
    setAnchorEl(null);
  };

  const renderButton = (item: LayoutMenuItem) => {
    if (item.external) {
      return (
        <Button
          key={item.title}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "#d9f8fa",
            textTransform: "none",
            "&:hover": { color: "#72fff0" },
          }}
        >
          {item.title}
        </Button>
      );
    }

    return (
      <Button
        key={item.title}
        component={Link}
        to={item.href}
        sx={{
          color: "#d9f8fa",
          textTransform: "none",
          "&:hover": { color: "#72fff0" },
        }}
      >
        {item.title}
      </Button>
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        color: "#e8fbff",
        backgroundColor: "#05080c",
        backgroundImage: [
          "radial-gradient(circle at 16% 18%, rgba(18, 238, 207, 0.16), transparent 28%)",
          "radial-gradient(circle at 82% 14%, rgba(109, 92, 255, 0.16), transparent 24%)",
          "linear-gradient(180deg, rgba(5, 8, 12, 0.72), #05080c 68%)",
          "url('https://images.unsplash.com/photo-1532187643603-ba119ca4109e?auto=format&fit=crop&w=2200&q=80')",
        ].join(", "),
        backgroundAttachment: { xs: "scroll", md: "fixed" },
        backgroundPosition: "center top",
        backgroundSize: "cover",
      }}
    >
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 3,
          borderBottom: "1px solid rgba(147, 236, 229, 0.2)",
          backdropFilter: "blur(18px)",
          background: "rgba(5, 8, 12, 0.78)",
        }}
      >
        <Container maxWidth="xl">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ minHeight: 72, gap: 2 }}
          >
            <Stack
              component={Link}
              to="/"
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{ color: "inherit", textDecoration: "none" }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid rgba(144, 255, 243, 0.52)",
                  borderRadius: 1.5,
                  color: "#72fff0",
                  background: "rgba(9, 22, 28, 0.86)",
                  boxShadow: "0 0 30px rgba(38, 255, 223, 0.18)",
                }}
              >
                <BiotechIcon />
              </Box>
              <Box>
                <Typography
                  component="p"
                  sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0 }}
                >
                  Faryne 的實驗室
                </Typography>
              </Box>
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              sx={{ display: { xs: "none", lg: "flex" }, alignItems: "center" }}
            >
              {headerNavigationItems.map((item) =>
                isLayoutDropMenu(item) ? (
                  <Button
                    key={item.title}
                    onClick={(event) => handleMenuOpen(item, event)}
                    endIcon={<KeyboardArrowDownIcon />}
                    variant="outlined"
                    aria-haspopup="menu"
                    aria-expanded={openedMenu?.title === item.title}
                    sx={{
                      color: "#d9f8fa",
                      borderColor: "rgba(129, 249, 239, 0.28)",
                      background: "rgba(9, 22, 28, 0.62)",
                      textTransform: "none",
                      "&:hover": {
                        borderColor: "rgba(114, 255, 240, 0.64)",
                        background: "rgba(12, 34, 42, 0.72)",
                      },
                    }}
                  >
                    {item.title}
                  </Button>
                ) : (
                  renderButton(item)
                ),
              )}
              <Menu
                open={Boolean(openedMenu)}
                anchorEl={anchorEl}
                onClose={handleMenuClose}
                slotProps={{
                  paper: {
                    sx: {
                      mt: 1,
                      color: "#e8fbff",
                      border: "1px solid rgba(129, 249, 239, 0.24)",
                      background:
                        "linear-gradient(180deg, rgba(8, 18, 24, 0.98), rgba(4, 8, 13, 0.98))",
                      boxShadow: "0 24px 70px rgba(0, 0, 0, 0.52)",
                    },
                  },
                }}
              >
                {openedMenu?.items.map((item) => (
                  <MenuItem
                    key={item.title}
                    component={item.external ? "a" : Link}
                    href={item.external ? item.href : undefined}
                    to={!item.external ? item.href : undefined}
                    target={item.external ? "_blank" : undefined}
                    rel={item.external ? "noopener noreferrer" : undefined}
                    onClick={handleMenuClose}
                    sx={{
                      color: "#d9f8fa",
                      "&:hover": {
                        color: "#72fff0",
                        background: "rgba(114, 255, 240, 0.08)",
                      },
                    }}
                  >
                    {item.title}
                  </MenuItem>
                ))}
              </Menu>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Box component="main" sx={{ flex: "1 0 auto" }}>
        <Outlet />
      </Box>

      <Box
        component="footer"
        sx={{
          flexShrink: 0,
          borderTop: "1px solid rgba(128, 255, 242, 0.18)",
          background:
            "linear-gradient(180deg, rgba(4, 9, 14, 0.78), rgba(3, 6, 10, 0.96))",
        }}
      >
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Stack
            direction={{ xs: "column", lg: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", lg: "flex-start" }}
            spacing={3}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.25}
              sx={{ flexShrink: 0 }}
            >
              <FaryneLogo width={28} />
              <Stack spacing={0.75}>
                <Typography sx={{ color: "#a7bdc1", fontSize: 14 }}>
                  Powered By Faryne |{" "}
                  <MuiLink
                    href="https://faryne.dev/"
                    sx={{ color: "#d9f8fa", textDecorationColor: "#72fff0" }}
                  >
                    faryne.dev
                  </MuiLink>
                </Typography>
                <Box
                  sx={{
                    "& a": { color: "#d9f8fa" },
                    "& svg": { color: "#d9f8fa" },
                  }}
                >
                  <SocialLinks />
                </Box>
              </Stack>
            </Stack>
            <Box
              sx={{
                flexGrow: 1,
                width: "100%",
                "& a": { color: "#d9f8fa" },
                "& p, & span, & .MuiTypography-root": { color: "#a7bdc1" },
              }}
            >
              <FooterNavigation />
            </Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};
