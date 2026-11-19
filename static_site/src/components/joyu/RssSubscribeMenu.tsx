import { useState } from "react";
import {
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import RssFeedIcon from "@mui/icons-material/RssFeed";

import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import type { JoyuFeed } from "@/data/joyuFeeds.ts";

/**
 * RSS 訂閱：點圖示列出可訂閱的 feed，選一個就把網址複製起來（貼到閱讀器訂閱）。
 * 直接開 feed 網址瀏覽器只會顯示 XML，所以不做成連結
 */
export function RssSubscribeMenu({ feeds }: { feeds: JoyuFeed[] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  // 複製結果另外存：關掉提示時不清掉，淡出途中訊息才不會跳成另一句
  const [snack, setSnack] = useState({ open: false, ok: true });
  const copy = (url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => setSnack({ open: true, ok: true }))
      .catch(() => setSnack({ open: true, ok: false }));
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title="RSS 訂閱">
        <IconButton
          aria-label="RSS 訂閱"
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          sx={{ color: "#f26522" }}
        >
          <RssFeedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        open={Boolean(anchor)}
      >
        {feeds.map((f) => (
          <MenuItem key={f.url} onClick={() => copy(f.url)}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            {f.title}
          </MenuItem>
        ))}
      </Menu>
      <CustomSnackbar
        message={snack.ok ? "已複製 RSS 網址" : "複製失敗，請稍後再試"}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        open={snack.open}
        severity={snack.ok ? "success" : "error"}
      />
    </>
  );
}
