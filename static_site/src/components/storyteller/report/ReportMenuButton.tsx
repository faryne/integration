import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { IconButton, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import type { ReportTarget } from "@/types/storytellerReport.ts";
import { useOpenReport } from "./reportContext.ts";

// 原本沒有 ⋯ 選單的地方（作品首頁、創作者頁）用的檢舉入口：⋯ → 「🚩 檢舉作品」等。
export function ReportMenuButton({
  target,
  label,
}: {
  target: ReportTarget;
  // 選單項目文字，例如「檢舉作品」
  label: string;
}) {
  const openReport = useOpenReport();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      <IconButton
        aria-label="更多動作"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreHorizIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
      >
        <MenuItem
          sx={{ color: "error.main" }}
          onClick={() => {
            setAnchor(null);
            openReport(target);
          }}
        >
          🚩 {label}
        </MenuItem>
      </Menu>
    </>
  );
}
