import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
  Menu,
  MenuItem,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useState, type MouseEvent } from "react";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { FaryneLogo } from "./FaryneLogo";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import { type LayoutDropMenu, type LayoutMenuItem } from "@/types/layout.ts";

export function ModernHeader() {
  const [openedMenu, setOpenedMenu] = useState<LayoutDropMenu | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (
    menu: LayoutDropMenu,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    setOpenedMenu(menu);
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
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
          sx={{ color: "text.primary" }}
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
        sx={{ color: "text.primary" }}
      >
        {item.title}
      </Button>
    );
  };

  const renderMenuItem = (item: LayoutMenuItem) => {
    if (item.external) {
      return (
        <MenuItem
          key={item.title}
          component={"a"}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          {item.title}
        </MenuItem>
      );
    }

    return (
      <MenuItem
        key={item.title}
        component={Link}
        to={item.href}
        onClick={handleClose}
      >
        {item.title}
      </MenuItem>
    );
  };

  return (
    <>
      <AppBar
        position="fixed"
        color="default"
        elevation={1}
        sx={{
          top: 0,
          left: 0,
          right: 0,
          flexShrink: 0,
          width: "100%",
          bgcolor: (theme) =>
            theme.palette.mode === "light"
              ? "#F7F0FA" // 極淡薰衣草紫，配合 logo 淡背景
              : "#2C2538", // Dark mode 帶紫的深色
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters>
            <Box
              component={Link}
              to="/"
              sx={{
                display: { xs: "none", md: "flex" },
                alignItems: "center",
                gap: 1.25,
                mr: 4,
                textDecoration: "none",
              }}
            >
              <FaryneLogo width={34} />
              <Typography
                variant="h6"
                noWrap
                sx={{
                  fontWeight: 700,
                  color: "primary.main",
                }}
              >
                Faryne.dev
              </Typography>
            </Box>

            {/* Mobile logo */}
            <Box
              component={Link}
              to="/"
              sx={{
                display: { xs: "flex", md: "none" },
                alignItems: "center",
                mr: 2,
                textDecoration: "none",
              }}
            >
              <FaryneLogo width={26} />
            </Box>

            <Box
              sx={{ flexGrow: 1, display: { xs: "none", md: "flex" }, gap: 1 }}
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
                      color: "text.primary",
                      borderColor: "divider",
                      bgcolor: "background.paper",
                      "&:hover": {
                        borderColor: "primary.main",
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
                anchorEl={anchorEl}
                open={Boolean(openedMenu)}
                onClose={handleClose}
              >
                {openedMenu?.items.map(renderMenuItem)}
              </Menu>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      <Toolbar />
    </>
  );
}
