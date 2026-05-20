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
import { useState } from "react";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export function ModernHeader() {
  const [adultAnchor, setAdultAnchor] = useState<null | HTMLElement>(null);
  const [toolsAnchor, setToolsAnchor] = useState<null | HTMLElement>(null);

  const handleAdultOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAdultAnchor(event.currentTarget);
  };
  const handleToolsOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setToolsAnchor(event.currentTarget);
  };
  const handleClose = () => {
    setAdultAnchor(null);
    setToolsAnchor(null);
  };

  const adultItems = [
    { label: "難以名狀的抓圖器", path: "https://nekomaid.web.app", external: true },
    { label: "二次元常用英文 tag", path: "/yandere/tags" },
    { label: "AV 影片搜尋", path: "/av/video" },
    { label: "AV 女優搜尋", path: "/av/actress" },
  ];

  const toolItems = [
    { label: "匯率", path: "/data/rates" },
    { label: "YieldMax ETF 配息統計", path: "/data/etf/yieldmax" },
    { label: "台股 ETF 資訊", path: "/data/etf/twse" },
    { label: "即時消防出勤記錄", path: "/data/fire/realtime" },
    { label: "台灣指標", path: "/data/tw-stats" },
    { label: "爬蟲工具", path: "/tools/crawler" },
    { label: "Threads 截圖工具", path: "/tools/thread/capture" },
  ];

  return (
    <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters>
          <Typography
            variant="h6"
            noWrap
            component={Link}
            to="/"
            sx={{
              mr: 4,
              display: { xs: 'none', md: 'flex' },
              fontWeight: 700,
              color: 'primary.main',
              textDecoration: 'none',
            }}
          >
            Faryne.dev
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            <Button
              component={Link}
              to="/"
              sx={{ color: 'text.primary' }}
            >
              首頁
            </Button>

            <Button
              onClick={handleAdultOpen}
              endIcon={<KeyboardArrowDownIcon />}
              sx={{ color: 'text.primary' }}
            >
              大人的喜好
            </Button>
            <Menu
              anchorEl={adultAnchor}
              open={Boolean(adultAnchor)}
              onClose={handleClose}
            >
              {adultItems.map((item) => (
                <MenuItem
                  key={item.label}
                  component={item.external ? "a" : Link}
                  {...(item.external ? { href: item.path, target: "_blank", rel: "noopener noreferrer" } : { to: item.path })}
                  onClick={handleClose}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>

            <Button
              onClick={handleToolsOpen}
              endIcon={<KeyboardArrowDownIcon />}
              sx={{ color: 'text.primary' }}
            >
              方便工具
            </Button>
            <Menu
              anchorEl={toolsAnchor}
              open={Boolean(toolsAnchor)}
              onClose={handleClose}
            >
              {toolItems.map((item) => (
                <MenuItem
                  key={item.label}
                  component={Link}
                  to={item.path}
                  onClick={handleClose}
                >
                  {item.label}
                </MenuItem>
              ))}
            </Menu>

            <Button
              href="https://blog.faryne.dev"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: 'text.primary' }}
            >
              部落格
            </Button>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
