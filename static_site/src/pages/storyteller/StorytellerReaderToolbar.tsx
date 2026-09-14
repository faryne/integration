import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HistoryIcon from "@mui/icons-material/History";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Paper,
  Popover,
  Stack,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState, type MouseEvent, type ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import type {
  ReaderFontFamily,
  ReaderFontSize,
  ReaderLineHeight,
  ReaderMeasure,
  StorytellerReaderPreferences,
} from "@/pages/storyteller/useStorytellerReaderPreferences.ts";

const FONT_SIZES: ReaderFontSize[] = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
const LINE_HEIGHTS: Array<{ label: string; value: ReaderLineHeight }> = [
  { label: "緊", value: 1.7 },
  { label: "適中", value: 1.95 },
  { label: "寬", value: 2.2 },
];
const MEASURES: Array<{ label: string; value: ReaderMeasure }> = [
  { label: "窄", value: 640 },
  { label: "適中", value: 720 },
  { label: "寬", value: 820 },
];
const FONT_FAMILIES: Array<{ label: string; value: ReaderFontFamily }> = [
  { label: "系統", value: "system" },
  { label: "黑體", value: "sans" },
  { label: "明體", value: "serif" },
];

interface ReaderChapterLink {
  title: string;
  href: string;
}

function SettingButtons<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ label: string; value: T }>;
  onChange: (value: T) => void;
}) {
  return (
    <ButtonGroup size="small" variant="outlined">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "contained" : "outlined"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </ButtonGroup>
  );
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
  preferences: StorytellerReaderPreferences;
  onChangePreferences: (patch: Partial<StorytellerReaderPreferences>) => void;
  previousChapter?: ReaderChapterLink;
  nextChapter?: ReaderChapterLink;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
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

  const settingsContent = (
    <Stack spacing={1.5}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="body2" color="text.secondary">
          字體大小
        </Typography>
        <ButtonGroup size="small" variant="outlined">
          <Button
            aria-label="縮小字體"
            disabled={preferences.fontSize === FONT_SIZES[0]}
            onClick={() => {
              const index = Math.max(
                0,
                FONT_SIZES.indexOf(preferences.fontSize) - 1,
              );
              onChangePreferences({ fontSize: FONT_SIZES[index] });
            }}
          >
            A−
          </Button>
          <Button disabled sx={{ minWidth: 42 }}>
            {preferences.fontSize}
          </Button>
          <Button
            aria-label="放大字體"
            disabled={
              preferences.fontSize === FONT_SIZES[FONT_SIZES.length - 1]
            }
            onClick={() => {
              const index = Math.min(
                FONT_SIZES.length - 1,
                FONT_SIZES.indexOf(preferences.fontSize) + 1,
              );
              onChangePreferences({ fontSize: FONT_SIZES[index] });
            }}
          >
            A＋
          </Button>
        </ButtonGroup>
      </Stack>
      <Divider />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="body2" color="text.secondary">
          字體
        </Typography>
        <SettingButtons
          value={preferences.fontFamily}
          options={FONT_FAMILIES}
          onChange={(fontFamily) => onChangePreferences({ fontFamily })}
        />
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="body2" color="text.secondary">
          行距
        </Typography>
        <SettingButtons
          value={preferences.lineHeight}
          options={LINE_HEIGHTS}
          onChange={(lineHeight) => onChangePreferences({ lineHeight })}
        />
      </Stack>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Typography variant="body2" color="text.secondary">
          頁面寬度
        </Typography>
        <SettingButtons
          value={preferences.measure}
          options={MEASURES}
          onChange={(measure) => onChangePreferences({ measure })}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary">
        背景與深淺色沿用網站目前色系。
      </Typography>
    </Stack>
  );

  function mobileSheet(title: string, content: ReactNode, onClose: () => void) {
    return (
      <Box sx={{ p: 2, pb: 3 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          <IconButton aria-label={`關閉${title}`} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        {content}
      </Box>
    );
  }

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
          <Tooltip title={previousChapter?.title ?? "沒有上一篇"}>
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
                  上一章
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="目錄與已加入的書籤">
            <Button
              size="small"
              color="inherit"
              startIcon={<MenuBookIcon />}
              aria-expanded={navigationOpen}
              onClick={onOpenNavigation}
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
                章節
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
          <Tooltip title={nextChapter?.title ?? "沒有下一篇"}>
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
                  下一章
                </Box>
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Paper>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(historyAnchor)}
          onClose={() => setHistoryAnchor(null)}
          slotProps={{
            paper: { sx: { maxHeight: "78vh", borderRadius: "16px 16px 0 0" } },
          }}
        >
          {mobileSheet(
            "編輯歷史",
            <Box sx={{ maxHeight: "60vh", overflowY: "auto" }}>
              {renderHistory?.(() => setHistoryAnchor(null))}
            </Box>,
            () => setHistoryAnchor(null),
          )}
        </Drawer>
      ) : (
        <Popover
          open={Boolean(historyAnchor)}
          anchorEl={historyAnchor}
          onClose={() => setHistoryAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "center" }}
          transformOrigin={{ vertical: "bottom", horizontal: "center" }}
          slotProps={{
            paper: {
              sx: { width: 380, maxWidth: "calc(100vw - 24px)", p: 2 },
            },
          }}
        >
          <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
            編輯歷史
          </Typography>
          <Box sx={{ maxHeight: "55vh", overflowY: "auto" }}>
            {renderHistory?.(() => setHistoryAnchor(null))}
          </Box>
        </Popover>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(projectAnchor)}
          onClose={() => setProjectAnchor(null)}
          slotProps={{
            paper: { sx: { maxHeight: "78vh", borderRadius: "16px 16px 0 0" } },
          }}
        >
          {mobileSheet("作品資訊", projectDetails, () =>
            setProjectAnchor(null),
          )}
        </Drawer>
      ) : (
        <Popover
          open={Boolean(projectAnchor)}
          anchorEl={projectAnchor}
          onClose={() => setProjectAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "left" }}
          transformOrigin={{ vertical: "bottom", horizontal: "left" }}
          slotProps={{
            paper: { sx: { width: 440, maxWidth: "calc(100vw - 24px)", p: 2 } },
          }}
        >
          {projectDetails}
        </Popover>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(settingsAnchor)}
          onClose={() => setSettingsAnchor(null)}
          slotProps={{ paper: { sx: { borderRadius: "16px 16px 0 0" } } }}
        >
          {mobileSheet("閱讀設定", settingsContent, () =>
            setSettingsAnchor(null),
          )}
        </Drawer>
      ) : (
        <Popover
          open={Boolean(settingsAnchor)}
          anchorEl={settingsAnchor}
          onClose={() => setSettingsAnchor(null)}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
          transformOrigin={{ vertical: "bottom", horizontal: "right" }}
          slotProps={{
            paper: { sx: { width: 360, maxWidth: "calc(100vw - 24px)", p: 2 } },
          }}
        >
          {settingsContent}
        </Popover>
      )}
    </>
  );
}
