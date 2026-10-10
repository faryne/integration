import OutlinedFlagIcon from "@mui/icons-material/OutlinedFlag";
import { Box, Button, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useOpenReport } from "./reportContext.ts";

interface ReaderReportItem {
  id: string;
  label: string;
}

// 閱讀工具列的「檢舉」：設定頁檢舉這篇設定，故事頁檢舉這一話。
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
  const type = lore ? "lore" : "story";
  // 跟工具列其他按鈕同一套寫法：桌機「圖示＋文字」、手機只留圖示；tooltip 說明具體動作
  return (
    <Tooltip title={t(`moderation.report.title.${type}`)}>
      <Button
        size="small"
        color="inherit"
        startIcon={<OutlinedFlagIcon />}
        aria-label={t(`moderation.report.title.${type}`)}
        onClick={() =>
          openReport({
            type,
            publicId: item.id,
            projectPublicId,
            share,
            name: item.label,
          })
        }
        sx={{
          minWidth: { xs: 32, sm: "auto" },
          px: { xs: 0.75, sm: 1 },
          "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
        }}
      >
        <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
          {t("moderation.report.menu.action")}
        </Box>
      </Button>
    </Tooltip>
  );
}
