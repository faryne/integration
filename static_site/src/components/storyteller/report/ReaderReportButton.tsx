import OutlinedFlagIcon from "@mui/icons-material/OutlinedFlag";
import { Button, Tooltip } from "@mui/material";
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
  const item = lore ?? story;
  if (!item) return null;
  return (
    <Tooltip title="檢舉">
      <Button
        size="small"
        color="inherit"
        aria-label="檢舉"
        onClick={() =>
          openReport({
            type: lore ? "lore" : "story",
            publicId: item.id,
            projectPublicId,
            share,
            label: lore ? `設定〈${item.label}〉` : item.label,
          })
        }
        sx={{ minWidth: 32, px: 0.75 }}
      >
        <OutlinedFlagIcon fontSize="small" />
      </Button>
    </Tooltip>
  );
}
