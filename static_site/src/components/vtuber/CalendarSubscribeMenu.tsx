import { Button, ListItemIcon, Menu, MenuItem } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import EventIcon from "@mui/icons-material/Event";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useState } from "react";

import type { VtuberCalendarLinks } from "@/types/vtubers.ts";

interface CalendarSubscribeMenuProps {
  calendar: VtuberCalendarLinks;
  label: string;
  variant?: "contained" | "outlined";
  fullWidth?: boolean;
  onCopied: (ok: boolean) => void;
}

/** 訂閱行事曆選單：加入 Google 日曆、網頁檢視、複製 ICS 網址（Apple Calendar 等用） */
export function CalendarSubscribeMenu({
  calendar,
  label,
  variant = "contained",
  fullWidth,
  onCopied,
}: CalendarSubscribeMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = (url: string) => {
    window.open(url, "_blank", "noopener");
    setAnchor(null);
  };
  const copyICS = () => {
    navigator.clipboard
      .writeText(calendar.ics_url)
      .then(() => onCopied(true))
      .catch(() => onCopied(false));
    setAnchor(null);
  };

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        startIcon={<EventIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
      >
        {label}
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <MenuItem onClick={() => open(calendar.subscribe_url)}>
          <ListItemIcon>
            <AddIcon fontSize={"small"} />
          </ListItemIcon>
          加入 Google 日曆
        </MenuItem>
        <MenuItem onClick={() => open(calendar.embed_url)}>
          <ListItemIcon>
            <OpenInNewIcon fontSize={"small"} />
          </ListItemIcon>
          網頁檢視
        </MenuItem>
        <MenuItem onClick={copyICS}>
          <ListItemIcon>
            <ContentCopyIcon fontSize={"small"} />
          </ListItemIcon>
          複製 ICS 網址
        </MenuItem>
      </Menu>
    </>
  );
}
