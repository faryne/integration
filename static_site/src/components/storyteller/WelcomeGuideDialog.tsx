import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import AddIcon from "@mui/icons-material/Add";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import CableIcon from "@mui/icons-material/Cable";
import CollectionsIcon from "@mui/icons-material/Collections";
import EditNoteIcon from "@mui/icons-material/EditNote";
import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
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
import { STORYTELLER_AI_ASSISTANT_ENABLED } from "@/data/storyteller.ts";
import { Link as RouterLink } from "react-router-dom";
import { SteamRegistrationMarks } from "@/components/storyteller/SteamPanelAccent.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamPanelTopBarSx } from "@/data/storytellerTheme.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";

interface WelcomeGuideDialogProps {
  open: boolean;
  onClose: () => void;
}

interface FeatureHighlight {
  icon: ReactNode;
  key: string;
}

const allFeatureHighlights: (FeatureHighlight & { ai?: boolean })[] = [
  {
    icon: <AddIcon fontSize="small" />,
    key: "project",
  },
  {
    icon: <EditNoteIcon fontSize="small" />,
    key: "editor",
  },
  {
    icon: <CollectionsIcon fontSize="small" />,
    key: "assets",
  },
  {
    icon: <AutoAwesomeIcon fontSize="small" />,
    key: "agent",
    ai: true,
  },
  {
    icon: <CableIcon fontSize="small" />,
    key: "mcp",
  },
  {
    // 跟工作台工具頁「梭梭的記憶」同一個圖示
    icon: <PsychologyAltOutlinedIcon fontSize="small" />,
    key: "memory",
  },
  {
    icon: <BookmarkIcon fontSize="small" />,
    key: "history",
  },
  {
    icon: <PublicIcon fontSize="small" />,
    key: "publish",
  },
];

// 站內 AI 助理停用時不介紹（見 STORYTELLER_AI_ASSISTANT_ENABLED）
const featureHighlights = allFeatureHighlights.filter(
  (item) => STORYTELLER_AI_ASSISTANT_ENABLED || !item.ai,
);

/**
 * 新手完成筆名設定（PenNameDialog）後緊接著彈出的功能導覽，只在「這次真的是第一次
 * 設定成功」時觸發一次（見 StorytellerLayout 的 onCompleted 接線），不是每次登入都跳。
 * 目前沒有逐頁面 spotlight 導覽套件（見開發過程的調查），先用一個資訊型 dialog 列出
 * 主要功能重點＋一個「開始建立第一個專案」的 CTA，比較輕量、跟現有 PenNameDialog 的
 * 互動模式一致，之後真的需要逐步導覽再評估要不要導入專門的 tour 套件。
 */
export function WelcomeGuideDialog({ open, onClose }: WelcomeGuideDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ ...steamPanelTopBarSx, p: { xs: 2.5, sm: 3 } }}>
        <SteamRegistrationMarks />
        <Typography variant="h6" fontWeight={800}>
          {t("web.onboarding.welcomeTitle", { appName: STORYTELLER_APP_NAME })}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("web.onboarding.welcomeDescription")}
        </Typography>
      </Box>
      <DialogContent sx={{ pt: 1 }}>
        <Stack spacing={2}>
          {featureHighlights.map((feature) => (
            <Stack key={feature.key} direction="row" spacing={1.5}>
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
                  {t(`web.onboarding.features.${feature.key}.title`)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t(`web.onboarding.features.${feature.key}.description`)}
                </Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          {t("web.onboarding.later")}
        </Button>
        <Button
          component={RouterLink}
          to={steamloomPath("my/projects/new")}
          variant="contained"
          onClick={onClose}
        >
          {t("web.onboarding.firstProject")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
