import {
  AppBar,
  Button,
  Toolbar,
  Typography,
  Menu,
  MenuItem,
  Grid,
} from "@mui/material";
import { useState } from "react";

export function Header() {
  const [anchor1, setAnchor1] = useState<HTMLButtonElement | null>(null);
  const [anchor2, setAnchor2] = useState<HTMLButtonElement | null>(null);
  const defaultButtonCss = { color: "white" };
  return (
    <>
      <AppBar
        position={"relative"}
        sx={{
          maxWidth: "lg",
          // top: 0,
          // width: '100%',
          // left: '50%',
          // transform: 'translateX(-50%)',
          mx: "auto",
        }}
      >
        <Toolbar>
          <Typography variant={"subtitle1"}>Faryne的實驗室</Typography>
          <Button
            key={"A"}
            sx={defaultButtonCss}
            variant={"outlined"}
            onClick={(e) => setAnchor1(e.currentTarget)}
          >
            二次元
          </Button>
          <Menu
            key={"A1"}
            open={!!anchor1}
            anchorEl={anchor1}
            onClose={() => setAnchor1(null)}
          >
            <MenuItem
              component={"a"}
              onClick={() => setAnchor1(null)}
              href={"https://nekomaid.web.app"}
            >
              難以名狀的抓圖器
            </MenuItem>
            <MenuItem
              component={"a"}
              onClick={() => setAnchor1(null)}
              href={"/yandere/tags"}
            >
              二次元常用英文 tag
            </MenuItem>
          </Menu>
          <Button
            key={"B"}
            sx={defaultButtonCss}
            variant={"outlined"}
            onClick={(e) => setAnchor2(e.currentTarget)}
          >
            方便工具
          </Button>
          <Menu
            key={"B1"}
            open={!!anchor2}
            anchorEl={anchor2}
            onClose={() => setAnchor2(null)}
          >
            <MenuItem
              component={"a"}
              onClick={() => setAnchor2(null)}
              href={"/data/rates"}
            >
              匯率
            </MenuItem>
            <MenuItem
              component={"a"}
              onClick={() => setAnchor2(null)}
              href={"/data/tw-stats"}
            >
              台灣指標
            </MenuItem>
          </Menu>
          <Button
            sx={defaultButtonCss}
            component={"a"}
            href={"https://blog.faryne.dev"}
          >
            Faryne 的程式設計館
          </Button>
        </Toolbar>
      </AppBar>
      <Grid container>
        <Grid size={12} sx={{ lineHeight: "20px" }}>
          &nbsp;
        </Grid>
      </Grid>
    </>
  );
}
