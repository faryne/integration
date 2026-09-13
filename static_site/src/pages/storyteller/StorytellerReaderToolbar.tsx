import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
  Typography,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useState, type MouseEvent, type ReactNode } from "react";
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
  preferences,
  onChangePreferences,
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
  preferences: StorytellerReaderPreferences;
  onChangePreferences: (patch: Partial<StorytellerReaderPreferences>) => void;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [projectAnchor, setProjectAnchor] = useState<HTMLElement | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(
    null,
  );

  function openProject(event: MouseEvent<HTMLElement>) {
    setSettingsAnchor(null);
    setProjectAnchor(event.currentTarget);
  }

  function openSettings(event: MouseEvent<HTMLElement>) {
    setProjectAnchor(null);
    setSettingsAnchor(event.currentTarget);
  }

  const bookmarkButton = (
    <Button
      size="small"
      variant={bookmarkEditing ? "contained" : "text"}
      startIcon={bookmarkEditing ? <CheckIcon /> : <BookmarkBorderIcon />}
      disabled={!bookmarkEditingAvailable}
      aria-pressed={bookmarkEditing}
      onClick={onToggleBookmarkEditing}
      sx={{ whiteSpace: "nowrap" }}
    >
      {bookmarkEditing ? "完成" : "編輯書籤"}
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
        variant="outlined"
        square
        sx={(theme) => ({
          position: "sticky",
          top: { xs: 56, sm: 64 },
          zIndex: theme.zIndex.appBar - 1,
          mx: { xs: -2, sm: 0 },
          overflow: "hidden",
          bgcolor: alpha(theme.palette.background.paper, 0.94),
          backgroundImage: "none",
          backdropFilter: "blur(12px)",
        })}
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          aria-label={`本篇閱讀進度 ${progress}%`}
          sx={{ height: 3 }}
        />
        <Box
          sx={{
            minHeight: 48,
            px: { xs: 1, sm: 1.5 },
            py: 0.5,
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr) auto",
              md: "1fr auto 1fr",
            },
            gridTemplateAreas: {
              xs: '"left right" "title mobileBookmark"',
              md: '"left title right"',
            },
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ gridArea: "left", minWidth: 0 }}
          >
            <Button
              size="small"
              startIcon={<MenuBookIcon />}
              aria-expanded={navigationOpen}
              onClick={onOpenNavigation}
            >
              目錄
            </Button>
            <Button
              size="small"
              color="inherit"
              endIcon={<ExpandMoreIcon />}
              aria-expanded={Boolean(projectAnchor)}
              onClick={openProject}
              sx={{ minWidth: 0, maxWidth: { xs: 150, sm: 260 } }}
            >
              <Box
                component="span"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {projectName}
              </Box>
            </Button>
          </Stack>

          <Typography
            variant="body2"
            fontWeight={800}
            sx={{
              gridArea: "title",
              minWidth: 0,
              px: 1,
              textAlign: { xs: "left", md: "center" },
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {currentTitle ?? "尚無內容"}
          </Typography>

          <Box
            sx={{
              gridArea: "mobileBookmark",
              display: { xs: "block", md: "none" },
            }}
          >
            {bookmarkButton}
          </Box>

          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            justifyContent="flex-end"
            sx={{ gridArea: "right" }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              aria-label={`本篇閱讀進度 ${progress}%`}
              sx={{
                minWidth: 36,
                textAlign: "right",
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {progress}%
            </Typography>
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              {bookmarkButton}
            </Box>
            <Button
              size="small"
              color="inherit"
              startIcon={<TextFieldsIcon />}
              aria-label="閱讀設定"
              aria-expanded={Boolean(settingsAnchor)}
              onClick={openSettings}
              sx={{ minWidth: { xs: 36, sm: "auto" }, px: { xs: 0.75, sm: 1 } }}
            >
              <Box
                component="span"
                sx={{ display: { xs: "none", sm: "inline" } }}
              >
                閱讀設定
              </Box>
            </Button>
          </Stack>
        </Box>
      </Paper>

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
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
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
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
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
