import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Box,
  Button,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  formatStorytellerDate,
  STORYTELLER_APP_NAME,
} from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";

// Notion 風工作台的固定頂欄＋出血容器——專案工作台（ProjectWorkspacePreview）跟
// 帳號工作台（Home，創作專案／AI Agent／金鑰管理等）共用同一套殼，差別只在
// title 是否要做成專案切換用的下拉選單。
export function WorkspaceChrome({
  title,
  titleDropdown = true,
  showHomeCrumb = true,
  projectId,
  projects = [],
  trail = [],
  action,
  children,
}: {
  title: string;
  // 專案工作台的 title 是「目前專案名稱」，點下去可以切換到其他專案；帳號工作台
  // （Home）的 title 就是「我的工作台」本身，沒有其他東西可以切換，這時關掉下拉
  // 選單，只當一段純文字麵包屑。
  titleDropdown?: boolean;
  // Home 本身就是「我的工作台」，title 已經等於這一段，不用在前面重複插入
  // 「我的工作台 >」；專案工作台底下才需要這段固定前綴把使用者帶回帳號工作台。
  showHomeCrumb?: boolean;
  projectId?: string;
  projects?: Array<{
    public_id: string;
    name: string;
    slug: string;
    updated_at: string;
  }>;
  // 麵包屑接在 title 後面的其餘段落，例如 ["作品", "桌布集"]或["創作專案"]——由
  // 呼叫端依目前選到的分組／收藏集／分頁組好，這裡只負責照順序插上分隔符號渲染。
  trail?: string[];
  action?: ReactNode;
  children: ReactNode;
}) {
  const [projectMenuAnchor, setProjectMenuAnchor] =
    useState<HTMLElement | null>(null);
  const switchableProjects = projects.filter(
    (project) => project.public_id !== projectId,
  );
  const titleIsMenu = titleDropdown && switchableProjects.length > 0;

  function closeProjectMenu() {
    setProjectMenuAnchor(null);
  }

  return (
    <Box
      sx={{
        position: "fixed",
        top: { xs: 56, sm: 64 },
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: (theme) => theme.zIndex.drawer,
        display: "flex",
        flexDirection: "column",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        color: (theme) =>
          theme.palette.mode === "dark" ? "#f1f1f0" : "#37352f",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{
          px: { xs: 1.5, md: 2 },
          py: 0.75,
          minHeight: 44,
          borderBottom: 1,
          borderColor: (theme) =>
            theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
          bgcolor: (theme) =>
            theme.palette.mode === "dark"
              ? alpha("#191919", 0.96)
              : alpha("#ffffff", 0.96),
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{
            minWidth: 0,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {/* 窄螢幕優先讓「目前選到哪個分組/收藏集」有空間顯示，站名跟「我的工作台」
              這兩段先收起來——真的還是放不下時，整條麵包屑本身可以橫向捲動（見外層
              overflowX），文字內容永遠不會被硬擠到看不見。 */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.75}
            sx={{ display: { xs: "none", sm: "flex" }, flexShrink: 0 }}
          >
            <Typography
              component={RouterLink}
              to={steamloomPath()}
              color="text.secondary"
              sx={{ textDecoration: "none", flexShrink: 0 }}
            >
              {STORYTELLER_APP_NAME}
            </Typography>
            <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
              &gt;
            </Typography>
            {showHomeCrumb && (
              <>
                <Typography
                  component={RouterLink}
                  to={steamloomPath("my")}
                  color="text.secondary"
                  sx={{ textDecoration: "none", flexShrink: 0 }}
                >
                  我的工作台
                </Typography>
                <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
                  &gt;
                </Typography>
              </>
            )}
          </Stack>
          {titleIsMenu ? (
            <Stack
              component={RouterLink}
              to={projectId ? steamloomPath(`my/workspace/${projectId}`) : "#"}
              direction="row"
              alignItems="center"
              spacing={0.25}
              onClick={(event) => {
                event.preventDefault();
                setProjectMenuAnchor((current) =>
                  current ? null : event.currentTarget,
                );
              }}
              sx={{
                flexShrink: 0,
                color: "primary.main",
                textDecoration: "none",
                fontWeight: 800,
                "&:hover": { color: "primary.dark" },
              }}
            >
              <Typography fontWeight={800} noWrap>
                {title}
              </Typography>
              <Typography
                component="span"
                color="text.secondary"
                sx={{ lineHeight: 1 }}
              >
                ▾
              </Typography>
            </Stack>
          ) : (
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.25}
              sx={{ flexShrink: 0, color: "primary.main", fontWeight: 800 }}
            >
              <Typography fontWeight={800} noWrap>
                {title}
              </Typography>
            </Stack>
          )}
          {trail
            .filter((segment) => segment)
            .map((segment, index) => (
              <Stack
                key={index}
                direction="row"
                alignItems="center"
                spacing={0.75}
                sx={{ flexShrink: 0 }}
              >
                <Typography color="text.secondary" sx={{ flexShrink: 0 }}>
                  &gt;
                </Typography>
                <Typography color="text.secondary" noWrap>
                  {segment}
                </Typography>
              </Stack>
            ))}
        </Stack>
        {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
      </Stack>
      {titleIsMenu && (
        <Menu
          anchorEl={projectMenuAnchor}
          open={Boolean(projectMenuAnchor)}
          onClose={closeProjectMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
          transformOrigin={{ vertical: "top", horizontal: "left" }}
          disableAutoFocusItem
          MenuListProps={{ dense: true }}
          slotProps={{
            paper: {
              sx: { minWidth: 240, maxWidth: 360 },
            },
          }}
        >
          {switchableProjects.map((project) => (
            <MenuItem
              key={project.public_id}
              component={RouterLink}
              to={steamloomPath(`my/workspace/${project.public_id}`)}
              onClick={closeProjectMenu}
              sx={{
                borderBottom: 1,
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
                py: 1,
              }}
            >
              <ListItemText
                primary={project.name}
                secondary={`最後更新 ${formatStorytellerDate(project.updated_at)}`}
                primaryTypographyProps={{ noWrap: true }}
                secondaryTypographyProps={{ noWrap: true }}
              />
            </MenuItem>
          ))}
        </Menu>
      )}
      {children}
    </Box>
  );
}

// 右欄的出血容器——不管是列表還是編輯器都用滿欄寬，不像舊版那樣置中收窄成一欄
// 文章排版，只留最基本的內距讓內容不會貼齊邊框。
export function WorkspaceBleedContainer({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2.5 }, py: { xs: 1, md: 1.5 } }}>
      {children}
    </Box>
  );
}

// 編輯器（既有資料或新建）額外在最上面放「回列表」，用帶圖示的膠囊按鈕取代純文字
// 連結——編輯器內容本身很大一片，純文字連結太不顯眼，容易讓人找不到返回的路。
export function EditorBleedContainer({
  onBack,
  children,
}: {
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <WorkspaceBleedContainer>
      <Stack spacing={1.5}>
        <Box>
          <Button
            size="small"
            variant="text"
            startIcon={<ArrowBackIcon fontSize="small" />}
            onClick={onBack}
            sx={{
              borderRadius: 1,
              px: 1,
              color: "text.secondary",
              "&:hover": {
                color: "primary.main",
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            回列表
          </Button>
        </Box>
        {children}
      </Stack>
    </WorkspaceBleedContainer>
  );
}

export function WorkspaceCentered({ children }: { children: ReactNode }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      textAlign="center"
      sx={{ minHeight: "calc(100vh - 150px)", p: 3 }}
    >
      {children}
    </Stack>
  );
}
