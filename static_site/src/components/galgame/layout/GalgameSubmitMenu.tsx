import { Menu, MenuItem } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

import { galgameSubmitItems } from "@/components/galgame/layout/galgameNavigation.ts";
import { galgamePath } from "@/helpers/galgame.ts";

/** 投稿選單（追加頻道／追加影片），桌機「＋ 投稿」按鈕與手機底部導覽共用 */
export function GalgameSubmitMenu({
  anchorEl,
  onClose,
}: {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      {galgameSubmitItems.map((item) => (
        <MenuItem
          key={item.key}
          component={RouterLink}
          to={galgamePath(item.path)}
          onClick={onClose}
        >
          {t(`galgame.layout.nav.${item.key}`)}
        </MenuItem>
      ))}
    </Menu>
  );
}
