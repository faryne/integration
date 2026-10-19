import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  WorkspaceSidebar,
  type WorkspaceSidebarProps,
} from "./ProjectWorkspacePreviewComponents.tsx";
import { shortcutLabel } from "@/helpers/shortcut.ts";
import { workspaceToolPages } from "@/pages/storyteller/workspaceToolPages.tsx";
import { WorkspaceRailButton } from "./WorkspaceSidebarChrome.tsx";

interface WorkspaceMobileNavigatorDrawerProps extends WorkspaceSidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Mobile 專案樹退出 document flow，list 與 editor 共用同一個 temporary Drawer。 */
export function WorkspaceMobileNavigatorDrawer({
  open,
  onClose,
  ...sidebarProps
}: WorkspaceMobileNavigatorDrawerProps) {
  const { t } = useTranslation();
  return (
    <Drawer
      open={open}
      onClose={onClose}
      keepMounted
      slotProps={{
        paper: {
          sx: {
            width: "min(88vw, 360px)",
            bgcolor: "background.paper",
            backgroundImage: "none",
          },
        },
      }}
    >
      <Stack sx={{ height: 1, minHeight: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{
            minHeight: 58,
            px: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <MenuBookOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t("web.workspacePreview.projectNavigation")}
            </Typography>
            <Typography fontWeight={800} noWrap>
              {sidebarProps.project?.name ?? t("web.workspacePreview.workspace")}
            </Typography>
          </Box>
          <IconButton aria-label={t("web.workspacePreview.closeProjectNavigation")} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <WorkspaceSidebar
            {...sidebarProps}
            onNavigate={onClose}
            onSelect={(section, collectionId) => {
              sidebarProps.onSelect(section, collectionId);
              onClose();
            }}
            onSelectItem={(item, collectionId) => {
              sidebarProps.onSelectItem(item, collectionId);
              onClose();
            }}
            onCreateVolume={() => {
              onClose();
              sidebarProps.onCreateVolume?.();
            }}
            onCreateLoreCollection={() => {
              onClose();
              sidebarProps.onCreateLoreCollection?.();
            }}
            onCreateAssetCollection={() => {
              onClose();
              sidebarProps.onCreateAssetCollection?.();
            }}
            onOpenToolPage={(page) => {
              onClose();
              sidebarProps.onOpenToolPage?.(page);
            }}
          />
        </Box>
      </Stack>
    </Drawer>
  );
}

/** Desktop 收合後仍保留三個分組與各個工具頁的入口，不讓 52px 欄位只是空白佔位。 */
export function WorkspaceSidebarRail({
  selected,
  onSelect,
  onSearch,
  activeToolPage,
  onOpenToolPage,
}: Pick<
  WorkspaceSidebarProps,
  "selected" | "onSelect" | "activeToolPage" | "onOpenToolPage"
> & {
  onSearch: () => void;
}) {
  const { t } = useTranslation();
  const items = [
    {
      section: "stories" as const,
      label: t("web.projectWorkspace.tabs.stories"),
      icon: <AutoStoriesIcon />,
    },
    { section: "lores" as const, label: t("web.projectWorkspace.tabs.lores"), icon: <SettingsIcon /> },
    { section: "assets" as const, label: t("web.projectWorkspace.tabs.assets"), icon: <CollectionsIcon /> },
  ];

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ py: 5.5 }}>
      {/* 收合時沒有空間放輸入框，改成直接開搜尋對話框的圖示。 */}
      <Tooltip title={t("web.workspacePreview.searchProjectShortcut", {
          shortcut: shortcutLabel("K"),
        })} placement="right">
        <IconButton
          size="small"
          aria-label={t("web.workspacePreview.searchProject")}
          onClick={onSearch}
          sx={{ borderRadius: 1, mb: 1 }}
        >
          <SearchIcon />
        </IconButton>
      </Tooltip>
      {items.map((item) => (
        <WorkspaceRailButton
          key={item.section}
          icon={item.icon}
          label={item.label}
          selected={!activeToolPage && selected.section === item.section}
          onClick={() => onSelect(item.section, "")}
        />
      ))}
      {onOpenToolPage &&
        workspaceToolPages.map((page) => (
          <WorkspaceRailButton
            key={page.key}
            icon={page.icon()}
            label={t(page.labelKey)}
            selected={activeToolPage === page.key}
            onClick={() => onOpenToolPage(page.key)}
          />
        ))}
    </Stack>
  );
}
