import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import CollectionsIcon from "@mui/icons-material/Collections";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import SettingsIcon from "@mui/icons-material/Settings";
import {
  Box,
  Collapse,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Pagination,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useState, type ReactNode } from "react";
import {
  storytellerPaletteMeta,
  type StorytellerPaletteName,
} from "@/data/storytellerTheme.ts";
import { useStorytellerPalette } from "@/layouts/storytellerPaletteMode.tsx";
import {
  ungroupedId,
  type SelectedItem,
  type SelectedNode,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import {
  AssetCard,
  LoreRow,
  StoryRow,
} from "./ProjectWorkspacePreviewRows.tsx";
import type {
  StorytellerAsset,
  StorytellerLore,
  StorytellerStory,
} from "@/types/storyteller.ts";

export function WorkspaceSidebar({
  selected,
  stories,
  volumes,
  loreCollections,
  assetCollections,
  onSelect,
}: {
  selected: SelectedNode;
  stories: StorytellerStory[];
  volumes: StorytellerStory[];
  loreCollections: Array<{
    public_id: string;
    name: string;
    lore_count: number;
  }>;
  assetCollections: Array<{
    public_id: string;
    name: string;
    asset_count: number;
  }>;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
}) {
  const storyCount = stories.filter((story) => !story.is_volume).length;
  const ungroupedStoryCount = stories.filter(
    (story) => !story.is_volume && story.parent_id === null,
  ).length;
  return (
    <Stack sx={{ height: 1, color: "text.secondary" }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1, pb: 0 }}>
        <SidebarGroup
          title="作品與冊"
          section="stories"
          icon={<AutoStoriesIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部作品", count: storyCount },
            { id: ungroupedId, label: "未分冊", count: ungroupedStoryCount },
            ...volumes.map((volume) => ({
              id: volume.public_id,
              label: volume.title,
              count: stories.filter((story) => story.parent_id === volume.id)
                .length,
            })),
          ]}
          onSelect={onSelect}
        />
        <SidebarGroup
          title="設定集"
          section="lores"
          icon={<SettingsIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部設定" },
            { id: ungroupedId, label: "未分類" },
            ...loreCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.lore_count,
            })),
          ]}
          onSelect={onSelect}
        />
        <SidebarGroup
          title="資產集"
          section="assets"
          icon={<CollectionsIcon fontSize="small" />}
          selected={selected}
          rows={[
            { id: "", label: "全部資產" },
            { id: ungroupedId, label: "未分類" },
            ...assetCollections.map((collection) => ({
              id: collection.public_id,
              label: collection.name,
              count: collection.asset_count,
            })),
          ]}
          onSelect={onSelect}
        />
      </Box>
      <WorkspaceSidebarFooter />
    </Stack>
  );
}

function SidebarGroup({
  title,
  section,
  icon,
  selected,
  rows,
  onSelect,
}: {
  title: string;
  section: WorkspaceSection;
  icon: ReactNode;
  selected: SelectedNode;
  rows: Array<{ id: string; label: string; count?: number }>;
  onSelect: (section: WorkspaceSection, collectionId: string) => void;
}) {
  return (
    <Box>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 1, py: 0.75 }}
      >
        <Box sx={{ lineHeight: 0, opacity: 0.82 }}>{icon}</Box>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ letterSpacing: 0 }}
        >
          {title}
        </Typography>
      </Stack>
      <List dense disablePadding sx={{ mt: 0.5 }}>
        {rows.map((row) => {
          const hasChildren = row.id !== "" && (row.count ?? 0) > 0;
          return (
            <ListItemButton
              key={`${section}-${row.id}`}
              selected={
                selected.section === section && selected.collectionId === row.id
              }
              onClick={() => onSelect(section, row.id)}
              sx={{
                borderRadius: 1,
                my: 0.125,
                minHeight: 30,
                px: 1,
                color: "text.secondary",
                "&:hover": {
                  bgcolor: (theme) =>
                    theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8",
                },
                "&.Mui-selected": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.13),
                  color: "text.primary",
                  borderLeft: 3,
                  borderLeftColor: "primary.main",
                  pl: 0.625,
                },
                "&.Mui-selected:hover": {
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.16),
                },
              }}
            >
              <Box
                sx={{
                  width: 16,
                  lineHeight: 0,
                  visibility: hasChildren ? "visible" : "hidden",
                }}
              >
                <KeyboardArrowRightIcon fontSize="inherit" />
              </Box>
              <ListItemIcon
                sx={{
                  minWidth: 26,
                  color:
                    selected.section === section &&
                    selected.collectionId === row.id
                      ? "primary.main"
                      : "inherit",
                }}
              >
                <FolderIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={row.label}
                primaryTypographyProps={{
                  fontWeight: 700,
                  noWrap: true,
                  fontSize: 13,
                }}
              />
              {row.count !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  {row.count}
                </Typography>
              )}
            </ListItemButton>
          );
        })}
      </List>
      <Divider sx={{ my: 0.75, opacity: 0.35 }} />
    </Box>
  );
}

function WorkspaceSidebarFooter() {
  const { palette, setPalette } = useStorytellerPalette();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const currentPalette = storytellerPaletteMeta[palette];

  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        px: 1,
        pt: 1.25,
        pb: 0.75,
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
        borderTop: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
        flexShrink: 0,
      }}
    >
      <ListItemButton
        onClick={() => setPaletteOpen((value) => !value)}
        sx={{ minHeight: 30, px: 1, borderRadius: 1 }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            bgcolor: currentPalette.swatch,
            border: 1,
            borderColor: "divider",
            mr: 1,
            flexShrink: 0,
          }}
        />
        <ListItemText
          primary={`色系：${currentPalette.label}`}
          primaryTypographyProps={{ variant: "caption", noWrap: true }}
        />
        <KeyboardArrowRightIcon
          fontSize="small"
          sx={{
            transform: paletteOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease",
          }}
        />
      </ListItemButton>
      <Collapse in={paletteOpen} timeout="auto" unmountOnExit>
        <Stack
          direction="row"
          flexWrap="wrap"
          useFlexGap
          gap={0.75}
          sx={{ p: 1 }}
        >
          {(
            Object.keys(storytellerPaletteMeta) as StorytellerPaletteName[]
          ).map((name) => {
            const meta = storytellerPaletteMeta[name];
            const isActive = palette === name;
            return (
              <Tooltip key={name} title={meta.label}>
                <Box
                  component="button"
                  type="button"
                  aria-label={`切換為${meta.label}色系`}
                  aria-pressed={isActive}
                  onClick={() => setPalette(name)}
                  sx={{
                    width: 20,
                    height: 20,
                    p: 0,
                    border: "2px solid",
                    borderColor: isActive ? "text.primary" : "divider",
                    borderRadius: "50%",
                    bgcolor: meta.swatch,
                    cursor: "pointer",
                  }}
                />
              </Tooltip>
            );
          })}
        </Stack>
      </Collapse>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", px: 1, pt: 1.25, lineHeight: 1.35 }}
      >
        SteamLoom powered By Faryne
        <br />
        <Typography
          component="a"
          variant="caption"
          href="https://faryne.dev/"
          target="_blank"
          rel="noopener noreferrer"
          sx={{ color: "inherit", textDecoration: "underline" }}
        >
          faryne.dev
        </Typography>
      </Typography>
    </Box>
  );
}

export function WorkspaceMobileNav(
  props: Parameters<typeof WorkspaceSidebar>[0],
) {
  return (
    <Box
      sx={{
        p: 1,
        borderBottom: 1,
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
        bgcolor: (theme) =>
          theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          maxHeight: 280,
          overflow: "auto",
          borderRadius: 1,
          bgcolor: "transparent",
        }}
      >
        <WorkspaceSidebar {...props} />
      </Paper>
    </Box>
  );
}

export function WorkspacePane({
  title,
  selected,
  stories,
  lores,
  assets,
  loading,
  onSelectItem,
  actions,
  titleActions,
  pagination,
  renderStoryActions,
  renderLoreActions,
  renderAssetActions,
}: {
  title: string;
  selected: SelectedNode;
  stories: StorytellerStory[];
  lores: StorytellerLore[];
  assets: StorytellerAsset[];
  loading: boolean;
  onSelectItem: (item: SelectedItem) => void;
  actions?: ReactNode;
  titleActions?: ReactNode;
  pagination?: {
    count: number;
    page: number;
    onChange: (page: number) => void;
  };
  renderStoryActions?: (story: StorytellerStory) => ReactNode;
  renderLoreActions?: (lore: StorytellerLore) => ReactNode;
  renderAssetActions?: (asset: StorytellerAsset) => ReactNode;
}) {
  const count =
    selected.section === "stories"
      ? stories.length
      : selected.section === "lores"
        ? lores.length
        : assets.length;
  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        spacing={1}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            工作台 / {loading ? "同步中" : `${count} 個項目`}
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Typography
              variant="h3"
              fontWeight={700}
              color="primary.main"
              sx={{ letterSpacing: 0, minWidth: 0 }}
              noWrap
            >
              {title}
            </Typography>
            {titleActions && <Box sx={{ flexShrink: 0 }}>{titleActions}</Box>}
          </Stack>
        </Box>
        {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
      </Stack>
      {selected.section === "stories" && (
        <Stack spacing={0.5}>
          {stories.map((story) => (
            <StoryRow
              key={story.public_id}
              story={story}
              actions={renderStoryActions?.(story)}
              onClick={() => onSelectItem({ type: "story", row: story })}
            />
          ))}
          {!loading && stories.length === 0 && (
            <WorkspaceEmptyState
              icon={<ArticleIcon />}
              title="沒有作品"
              description="這個分類目前沒有作品。"
            />
          )}
          {pagination && pagination.count > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
              <Pagination
                count={pagination.count}
                page={pagination.page}
                onChange={(_, page) => pagination.onChange(page)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      )}
      {selected.section === "lores" && (
        <Stack spacing={0.5}>
          {lores.map((lore) => (
            <LoreRow
              key={lore.public_id}
              lore={lore}
              actions={renderLoreActions?.(lore)}
              onClick={() => onSelectItem({ type: "lore", row: lore })}
            />
          ))}
          {!loading && lores.length === 0 && (
            <WorkspaceEmptyState
              icon={<DescriptionIcon />}
              title="沒有設定"
              description="這個分類目前沒有設定。"
            />
          )}
          {pagination && pagination.count > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5 }}>
              <Pagination
                count={pagination.count}
                page={pagination.page}
                onChange={(_, page) => pagination.onChange(page)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      )}
      {selected.section === "assets" && (
        <Grid container spacing={1.5}>
          {assets.map((asset) => (
            <Grid key={asset.public_id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <AssetCard
                asset={asset}
                actions={renderAssetActions?.(asset)}
                onClick={() => onSelectItem({ type: "asset", row: asset })}
              />
            </Grid>
          ))}
          {!loading && assets.length === 0 && (
            <Grid size={12}>
              <WorkspaceEmptyState
                icon={<CollectionsIcon />}
                title="沒有資產"
                description="這個分類目前沒有資產。"
              />
            </Grid>
          )}
          {pagination && pagination.count > 1 && (
            <Grid size={12}>
              <Box sx={{ display: "flex", justifyContent: "center", pt: 1 }}>
                <Pagination
                  count={pagination.count}
                  page={pagination.page}
                  onChange={(_, page) => pagination.onChange(page)}
                  color="primary"
                />
              </Box>
            </Grid>
          )}
        </Grid>
      )}
    </Stack>
  );
}

function WorkspaceEmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Stack
      spacing={1}
      alignItems="center"
      justifyContent="center"
      textAlign="center"
      sx={{
        minHeight: 180,
        mt: 1,
        px: 3,
        py: 4,
        border: 1,
        borderStyle: "dashed",
        borderColor: (theme) =>
          theme.palette.mode === "dark" ? "#3a3a3a" : "#dedbd3",
        borderRadius: 1,
        color: "text.secondary",
        bgcolor: (theme) =>
          theme.palette.mode === "dark"
            ? alpha("#ffffff", 0.018)
            : alpha("#37352f", 0.025),
      }}
    >
      <Box sx={{ color: "primary.main", opacity: 0.64, lineHeight: 0 }}>
        {icon}
      </Box>
      <Typography fontWeight={800} color="text.primary">
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {description}
      </Typography>
    </Stack>
  );
}
