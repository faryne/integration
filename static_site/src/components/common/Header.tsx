import {
  AppBar,
  Button,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Box,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useState, type MouseEvent } from "react";
import { headerNavigationItems, isLayoutDropMenu } from "@/data/navigation.ts";
import { type LayoutDropMenu, type LayoutMenuItem } from "@/types/layout.ts";

export interface HeaderProps {
  fullWidth?: boolean;
}

export function Header({ fullWidth = false }: HeaderProps) {
  const [openedMenu, setOpenedMenu] = useState<LayoutDropMenu | null>(null);
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const defaultButtonCss = { color: "white" };

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

  const renderButton = (item: LayoutMenuItem) => (
    <Button
      key={item.title}
      sx={defaultButtonCss}
      component={"a"}
      href={item.href}
      target={item.external ? "_blank" : undefined}
      rel={item.external ? "noopener noreferrer" : undefined}
    >
      {item.title}
    </Button>
  );

  return (
    <>
      <AppBar
        position={"fixed"}
        sx={{
          top: 0,
          left: "50%",
          right: "auto",
          width: fullWidth ? "100%" : "1280px",
          transform: "translateX(-50%)",
          mx: "auto",
        }}
      >
        <Toolbar>
          <Typography variant={"subtitle1"}>Faryne的實驗室</Typography>
          {headerNavigationItems.map((item) =>
            isLayoutDropMenu(item) ? (
              <Button
                key={item.title}
                sx={defaultButtonCss}
                variant={"outlined"}
                endIcon={<KeyboardArrowDownIcon />}
                aria-haspopup={"menu"}
                aria-expanded={openedMenu?.title === item.title}
                onClick={(event) => handleMenuOpen(item, event)}
              >
                {item.title}
              </Button>
            ) : (
              renderButton(item)
            ),
          )}
          <Menu
            open={!!openedMenu}
            anchorEl={anchorEl}
            onClose={handleMenuClose}
          >
            {openedMenu?.items.map((item) => (
              <MenuItem
                key={item.title}
                component={"a"}
                onClick={handleMenuClose}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
              >
                {item.title}
              </MenuItem>
            ))}
          </Menu>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box sx={{ height: 20 }} />
    </>
  );
}
