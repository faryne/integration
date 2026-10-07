import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CheckIcon from "@mui/icons-material/Check";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import { StorytellerResponsivePopover } from "@/pages/storyteller/StorytellerResponsivePopover.tsx";
import { StorytellerTypographySettings } from "@/pages/storyteller/StorytellerTypographySettings.tsx";
import type { StorytellerTypographyPreferences } from "@/pages/storyteller/useStorytellerTypographyPreferences.ts";

interface ReaderToolbarLabels {
  previous: string;
  next: string;
  navigation: string;
  navigationTooltip: string;
}

const STORY_TOOLBAR_LABELS: ReaderToolbarLabels = {
  previous: "上一章",
  next: "下一章",
  navigation: "章節",
  navigationTooltip: "目錄與已加入的書籤",
};

interface ReaderChapterLink {
  title: string;
  href: string;
}

export function StorytellerReaderToolbar({
  projectName,
  currentTitle,
  progress,
  navigationOpen,
  onOpenNavigation,
  projectDetails,
  bookmarkEditing,
  bookmarkEditingAvailable,
  onToggleBookmarkEditing,
  renderHistory,
  preferences,
  onChangePreferences,
  previousChapter,
  nextChapter,
  labels = STORY_TOOLBAR_LABELS,
  navigationHref,
}: {
  projectName: string;
  currentTitle?: string;
  progress: number;
  navigationOpen: boolean;
  onOpenNavigation: () => void;
  projectDetails: ReactNode;
  bookmarkEditing: boolean;
  bookmarkEditingAvailable: boolean;
  onToggleBookmarkEditing: () => void;
  renderHistory?: (onClose: () => void) => ReactNode;
  preferences: StorytellerTypographyPreferences;
  onChangePreferences: (
    patch: Partial<StorytellerTypographyPreferences>,
  ) => void;
  previousChapter?: ReaderChapterLink;
  nextChapter?: ReaderChapterLink;
  // 底部導覽列的用詞，設定頁改成「上一則／下一則／設定列表」；省略就是故事的章節用詞
  labels?: ReaderToolbarLabels;
  // 有給時「目錄」按鈕改成連結（設定頁直接回設定列表），不開側邊目錄抽屜
  navigationHref?: string;
}) {
  const [projectAnchor, setProjectAnchor] = useState<HTMLElement | null>(null);
  const [historyAnchor, setHistoryAnchor] = useState<HTMLElement | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(
    null,
  );

  function openProject(event: MouseEvent<HTMLElement>) {
    setSettingsAnchor(null);
    setHistoryAnchor(null);
    setProjectAnchor(event.currentTarget);
  }

  function openSettings(event: MouseEvent<HTMLElement>) {
    setProjectAnchor(null);
    setHistoryAnchor(null);
    setSettingsAnchor(event.currentTarget);
  }

  function openHistory(event: MouseEvent<HTMLElement>) {
    setProjectAnchor(null);
    setSettingsAnchor(null);
    setHistoryAnchor(event.currentTarget);
  }

  const bookmarkButton = (
    <Button
      size="small"
      variant={bookmarkEditing ? "contained" : "text"}
      startIcon={bookmarkEditing ? <CheckIcon /> : <BookmarkBorderIcon />}
      disabled={!bookmarkEditingAvailable}
      aria-pressed={bookmarkEditing}
      onClick={onToggleBookmarkEditing}
      sx={{
        minWidth: { xs: 32, sm: "auto" },
        px: { xs: 0.75, sm: 1 },
        whiteSpace: "nowrap",
        "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
      }}
    >
      <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
        {bookmarkEditing ? "完成" : "書籤"}
      </Box>
    </Button>
  );

  return (
    <>
      <Paper
        component="nav"
        aria-label="閱讀工具列"
        variant="outlined"
        sx={(theme) => ({
          position: "fixed",
          zIndex: theme.zIndex.appBar + 1,
          left: "50%",
          bottom: { xs: 8, sm: 18 },
          transform: "translateX(-50%)",
          width: {
            xs: "calc(100% - 8px)",
            sm: "min(920px, calc(100% - 28px))",
          },
          px: 0.75,
          py: 0.75,
          borderRadius: 0,
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backgroundImage: "none",
          boxShadow: "0 16px 54px rgba(0, 0, 0, 0.28)",
          backdropFilter: "blur(20px)",
          pb: "calc(6px + env(safe-area-inset-bottom))",
        })}
      >
        <Stack
          direction="row"
          spacing={{ xs: 0.125, sm: 0.25 }}
          alignItems="center"
        >
          <Tooltip title={previousChapter?.title ?? `沒有${labels.previous}`}>
            <span>
              <Button
                component={RouterLink}
                to={previousChapter?.href ?? "#"}
                size="small"
                color="inherit"
                disabled={!previousChapter}
                startIcon={<ArrowBackIcon />}
                sx={{
                  minWidth: { xs: 32, sm: "auto" },
                  px: { xs: 0.75, sm: 1 },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
                }}
              >
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline" } }}
                >
                  {labels.previous}
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={labels.navigationTooltip}>
            <Button
              size="small"
              color="inherit"
              startIcon={<MenuBookIcon />}
              {...(navigationHref
                ? { component: RouterLink, to: navigationHref }
                : {
                    "aria-expanded": navigationOpen,
                    onClick: onOpenNavigation,
                  })}
              sx={{
                minWidth: { xs: 32, sm: "auto" },
                px: { xs: 0.75, sm: 1 },
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                {labels.navigation}
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title={currentTitle ?? "閱讀進度"}>
            <Box
              sx={{
                flex: 1,
                minWidth: { xs: 20, sm: 90 },
                px: { xs: 0.25, sm: 1 },
              }}
            >
              <LinearProgress
                variant="determinate"
                value={progress}
                aria-label={`本篇閱讀進度 ${progress}%`}
                sx={{ height: "2px" }}
              />
            </Box>
          </Tooltip>
          <Typography
            variant="caption"
            color="primary.main"
            aria-label={`本篇閱讀進度 ${progress}%`}
            sx={{
              minWidth: { xs: 28, sm: 34 },
              textAlign: "right",
              fontFamily: "monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {progress}%
          </Typography>
          <Tooltip title={`作品資訊：${projectName}`}>
            <Button
              size="small"
              color="inherit"
              startIcon={<InfoOutlinedIcon />}
              aria-expanded={Boolean(projectAnchor)}
              onClick={openProject}
              sx={{
                minWidth: { xs: 32, sm: "auto" },
                px: { xs: 0.75, sm: 1 },
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", md: "inline" } }}
              >
                作品
              </Box>
            </Button>
          </Tooltip>
          {renderHistory && (
            <Tooltip title="編輯歷史">
              <Button
                size="small"
                color="inherit"
                startIcon={<HistoryIcon />}
                aria-label="編輯歷史"
                aria-expanded={Boolean(historyAnchor)}
                onClick={openHistory}
                sx={{
                  minWidth: { xs: 32, sm: "auto" },
                  px: { xs: 0.5, sm: 1 },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
                }}
              >
                <Box
                  component="span"
                  sx={{ display: { xs: "none", md: "inline" } }}
                >
                  歷史
                </Box>
              </Button>
            </Tooltip>
          )}
          <Tooltip title={bookmarkEditing ? "完成編輯書籤" : "編輯段落書籤"}>
            <span>{bookmarkButton}</span>
          </Tooltip>
          <Tooltip title="閱讀設定">
            <Button
              size="small"
              color="inherit"
              startIcon={<TextFieldsIcon />}
              aria-label="閱讀設定"
              aria-expanded={Boolean(settingsAnchor)}
              onClick={openSettings}
              sx={{
                minWidth: { xs: 32, sm: "auto" },
                px: { xs: 0.75, sm: 1 },
                "& .MuiButton-startIcon": { mr: { xs: 0, sm: 0.5 } },
              }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                閱讀
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title={nextChapter?.title ?? `沒有${labels.next}`}>
            <span>
              <Button
                component={RouterLink}
                to={nextChapter?.href ?? "#"}
                size="small"
                color="inherit"
                disabled={!nextChapter}
                endIcon={<ArrowForwardIcon />}
                sx={{
                  minWidth: { xs: 32, sm: "auto" },
                  px: { xs: 0.75, sm: 1 },
                  "& .MuiButton-endIcon": { ml: { xs: 0, sm: 0.5 } },
                }}
              >
                <Box
                  component="span"
                  sx={{ display: { xs: "none", sm: "inline" } }}
                >
                  {labels.next}
                </Box>
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <StorytellerResponsivePopover
        anchorEl={projectAnchor}
        onClose={() => setProjectAnchor(null)}
        title="作品資訊"
        width={440}
        horizontal="left"
        mobileMaxHeight="78vh"
      >
        {projectDetails}
      </StorytellerResponsivePopover>

      <StorytellerResponsivePopover
        anchorEl={historyAnchor}
        onClose={() => setHistoryAnchor(null)}
        title="編輯歷史"
        showTitleOnDesktop
        width={380}
        horizontal="center"
        mobileMaxHeight="78vh"
      >
        <Box sx={{ maxHeight: { xs: "60vh", sm: "55vh" }, overflowY: "auto" }}>
          {renderHistory?.(() => setHistoryAnchor(null))}
        </Box>
      </StorytellerResponsivePopover>

      <StorytellerResponsivePopover
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        title="閱讀設定"
        width={360}
      >
        <StorytellerTypographySettings
          preferences={preferences}
          onChange={onChangePreferences}
          caption="背景與深淺色沿用網站目前色系。"
        />
      </StorytellerResponsivePopover>
    </>
  );
}
