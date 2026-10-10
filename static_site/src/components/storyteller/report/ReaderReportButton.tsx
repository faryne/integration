import OutlinedFlagIcon from "@mui/icons-material/OutlinedFlag";
import { Button, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useOpenReport } from "./reportContext.ts";

interface ReaderReportItem {
  id: string;
  label: string;
}

// 閱讀工具列的「檢舉」：設定頁檢舉這篇設定，故事頁檢舉這一話。工具列空間有限，只放旗子圖示。
export function ReaderReportButton({
  projectPublicId,
  share,
  lore,
  story,
}: {
  projectPublicId: string;
  share?: string;
  lore?: ReaderReportItem;
  story?: ReaderReportItem;
}) {
  const openReport = useOpenReport();
  const { t } = useTranslation();
  const item = lore ?? story;
  if (!item) return null;
  return (
    <Tooltip title={t("moderation.report.menu.action")}>
      <Button
        size="small"
        color="inherit"
        aria-label={t("moderation.report.menu.action")}
        onClick={() =>
          openReport({
            type: lore ? "lore" : "story",
            publicId: item.id,
            projectPublicId,
            share,
            name: item.label,
          })
        }
        sx={{ minWidth: 32, px: 0.75 }}
      >
        <OutlinedFlagIcon fontSize="small" />
      </Button>
    </Tooltip>
  );
}
