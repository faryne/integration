import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { IconButton, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReportTarget } from "@/types/storytellerReport.ts";
import { useOpenReport } from "./reportContext.ts";

// 原本沒有 ⋯ 選單的地方（作品首頁、創作者頁）用的檢舉入口：⋯ → 「🚩 檢舉作品」等，
// 選單文字依種類取 moderation.report.menu.<type>。
export function ReportMenuButton({ target }: { target: ReportTarget }) {
  const openReport = useOpenReport();
  const { t } = useTranslation();
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
          🚩 {t(`moderation.report.menu.${target.type}`)}
        </MenuItem>
      </Menu>
    </>
  );
}
