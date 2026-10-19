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
import { useTranslation } from "react-i18next";
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
  labels,
  navigationHref,
  discussionButton,
  reportButton,
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
  // 討論按鈕（私人作品沒有討論版時不給）
  discussionButton?: ReactNode;
  // 檢舉按鈕（作者本人看自己的作品時不傳）
  reportButton?: ReactNode;
}) {
  const { t } = useTranslation();
  const resolvedLabels = labels ?? {
    previous: t("web.reader.toolbar.previous"),
    next: t("web.reader.toolbar.next"),
    navigation: t("web.reader.toolbar.navigation"),
    navigationTooltip: t("web.reader.toolbar.navigationTooltip"),
  };
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
        {bookmarkEditing ? t("web.reader.toolbar.done") : t("web.reader.toolbar.bookmark")}
      </Box>
    </Button>
  );

  return (
    <>
      <Paper
        component="nav"
        aria-label={t("web.reader.toolbar.aria")}
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
          <Tooltip title={previousChapter?.title ?? t("web.reader.toolbar.noPrevious", { label: resolvedLabels.previous })}>
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
                  {resolvedLabels.previous}
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={resolvedLabels.navigationTooltip}>
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
                {resolvedLabels.navigation}
              </Box>
            </Button>
          </Tooltip>
          <Tooltip title={currentTitle ?? t("web.reader.toolbar.progress")}>
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
                aria-label={t("web.reader.toolbar.progressAria", { progress })}
                sx={{ height: "2px" }}
              />
            </Box>
          </Tooltip>
          <Typography
            variant="caption"
            color="primary.main"
            aria-label={t("web.reader.toolbar.progressAria", { progress })}
            sx={{
              minWidth: { xs: 28, sm: 34 },
              textAlign: "right",
              fontFamily: "monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {progress}%
          </Typography>
          <Tooltip title={t("web.reader.toolbar.projectInfo", { project: projectName })}>
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
                {t("web.reader.toolbar.work")}
              </Box>
            </Button>
          </Tooltip>
          {renderHistory && (
            <Tooltip title={t("web.reader.toolbar.history")}>
              <Button
                size="small"
                color="inherit"
                startIcon={<HistoryIcon />}
                aria-label={t("web.reader.toolbar.history")}
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
                  {t("web.reader.toolbar.historyShort")}
                </Box>
              </Button>
            </Tooltip>
          )}
          <Tooltip title={bookmarkEditing ? t("web.reader.toolbar.finishBookmarks") : t("web.reader.toolbar.editBookmarks")}>
            <span>{bookmarkButton}</span>
          </Tooltip>
          {discussionButton}
          <Tooltip title={t("web.reader.toolbar.readingSettings")}>
            <Button
              size="small"
              color="inherit"
              startIcon={<TextFieldsIcon />}
              aria-label={t("web.reader.toolbar.readingSettings")}
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
                {t("web.reader.toolbar.reading")}
              </Box>
            </Button>
          </Tooltip>
          {reportButton}
          <Tooltip title={nextChapter?.title ?? t("web.reader.toolbar.noNext", { label: resolvedLabels.next })}>
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
                  {resolvedLabels.next}
                </Box>
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      <StorytellerResponsivePopover
        anchorEl={projectAnchor}
        onClose={() => setProjectAnchor(null)}
        title={t("web.reader.toolbar.projectInfoTitle")}
        width={440}
        horizontal="left"
        mobileMaxHeight="78vh"
      >
        {projectDetails}
      </StorytellerResponsivePopover>

      <StorytellerResponsivePopover
        anchorEl={historyAnchor}
        onClose={() => setHistoryAnchor(null)}
        title={t("web.reader.toolbar.history")}
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
        title={t("web.reader.toolbar.readingSettings")}
        width={360}
      >
        <StorytellerTypographySettings
          preferences={preferences}
          onChange={onChangePreferences}
          caption={t("web.reader.toolbar.settingsCaption")}
        />
      </StorytellerResponsivePopover>
    </>
  );
}
