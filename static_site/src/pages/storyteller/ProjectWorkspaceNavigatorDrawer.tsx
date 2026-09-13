import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CloseIcon from "@mui/icons-material/Close";
import CollectionsIcon from "@mui/icons-material/Collections";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Drawer,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  WorkspaceSidebar,
  type WorkspaceSidebarProps,
} from "./ProjectWorkspacePreviewComponents.tsx";

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
  return (
    <Drawer
      open={open}
      onClose={onClose}
      keepMounted
      slotProps={{
        paper: {
          sx: {
            width: "min(88vw, 360px)",
            bgcolor: (theme) =>
              theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
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
              專案導覽
            </Typography>
            <Typography fontWeight={800} noWrap>
              {sidebarProps.project?.name ?? "工作台"}
            </Typography>
          </Box>
          <IconButton aria-label="關閉專案導覽" onClick={onClose}>
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
          />
        </Box>
      </Stack>
    </Drawer>
  );
}

/** Desktop 收合後仍保留三個主要區域入口，不讓 52px 欄位只是空白佔位。 */
export function WorkspaceSidebarRail({
  selected,
  onSelect,
}: Pick<WorkspaceSidebarProps, "selected" | "onSelect">) {
  const items = [
    {
      section: "stories" as const,
      label: "作品與冊",
      icon: <AutoStoriesIcon />,
    },
    { section: "lores" as const, label: "設定集", icon: <SettingsIcon /> },
    { section: "assets" as const, label: "資產集", icon: <CollectionsIcon /> },
  ];

  return (
    <Stack alignItems="center" spacing={0.5} sx={{ py: 5.5 }}>
      {items.map((item) => (
        <Tooltip key={item.section} title={item.label} placement="right">
          <IconButton
            size="small"
            aria-label={item.label}
            color={selected.section === item.section ? "primary" : "default"}
            onClick={() => onSelect(item.section, "")}
            sx={{
              borderRadius: 1,
              bgcolor:
                selected.section === item.section
                  ? "action.selected"
                  : undefined,
            }}
          >
            {item.icon}
          </IconButton>
        </Tooltip>
      ))}
    </Stack>
  );
}
