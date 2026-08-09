import type { ReactNode } from "react";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CableIcon from "@mui/icons-material/Cable";
import CollectionsIcon from "@mui/icons-material/Collections";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PublicIcon from "@mui/icons-material/Public";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { SteamRivets } from "@/components/storyteller/SteamPanelAccent.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";

interface WelcomeGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FeatureHighlight {
  icon: ReactNode;
  title: string;
  description: string;
}

const featureHighlights: FeatureHighlight[] = [
  {
    icon: <AddIcon fontSize="small" />,
    title: "建立創作專案",
    description:
      "專案是所有創作的起點，故事、設定集、角色資料都收在同一個專案底下。",
  },
  {
    icon: <EditNoteIcon fontSize="small" />,
    title: "所見即所得編輯器",
    description:
      "打字就能用標題、引用、清單、表格、分隔線；還有腳注、只有你看得到的私人註解、文字顏色可以用。",
  },
  {
    icon: <CollectionsIcon fontSize="small" />,
    title: "資產庫",
    description: "上傳圖片建立資產庫，隨時插入故事或設定集裡使用。",
  },
  {
    icon: <AutoAwesomeIcon fontSize="small" />,
    title: "AI Agent（選用）",
    description:
      "帶上你自己的模型 API Key，設定 Agent 幫忙改寫或延伸故事內容。",
  },
  {
    icon: <CableIcon fontSize="small" />,
    title: "MCP 連接（選用）",
    description:
      "讓 Claude Code、Codex 等外部工具透過 MCP 直接讀寫你的故事與設定集，不用手動複製貼上。",
  },
  {
    icon: <BookmarkIcon fontSize="small" />,
    title: "版本歷史與書籤",
    description:
      "每次存檔都留一份版本紀錄，隨時可以回復；閱讀時也能替喜歡的段落加書籤。",
  },
  {
    icon: <PublicIcon fontSize="small" />,
    title: "公開發佈",
    description: "專案可以設成公開、不公開連結或私人，由你決定誰看得到作品。",
  },
];

/**
 * 新手完成筆名設定（PenNameDialog）後緊接著彈出的功能導覽，只在「這次真的是第一次
 * 設定成功」時觸發一次（見 StorytellerLayout 的 onCompleted 接線），不是每次登入都跳。
 * 目前沒有逐頁面 spotlight 導覽套件（見開發過程的調查），先用一個資訊型 dialog 列出
 * 主要功能重點＋一個「開始建立第一個專案」的 CTA，比較輕量、跟現有 PenNameDialog 的
 * 互動模式一致，之後真的需要逐步導覽再評估要不要導入專門的 tour 套件。
 */
export function WelcomeGuideDialog({ open, onClose }: WelcomeGuideDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ ...steamPanelTopBarSx, p: { xs: 2.5, sm: 3 } }}>
        <SteamRivets />
        <Typography variant="h6" fontWeight={800}>
          歡迎加入 {STORYTELLER_APP_NAME}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          筆名設定好了，這裡快速介紹幾個你會用到的功能：
        </Typography>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          {featureHighlights.map((feature) => (
            <Stack key={feature.title} direction="row" spacing={1.5}>
              <Box
                sx={{
                  color: "primary.main",
                  mt: "2px",
                  flexShrink: 0,
                }}
              >
                {feature.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          先逛逛，晚點再說
        </Button>
        <Button
          component={RouterLink}
          to={steamloomPath("my/project/new")}
          variant="contained"
          onClick={onClose}
        >
          開始建立第一個專案
        </Button>
      </DialogActions>
    </Dialog>
  );
}
