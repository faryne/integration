import ArticleIcon from "@mui/icons-material/Article";
import DescriptionIcon from "@mui/icons-material/Description";
import ImageIcon from "@mui/icons-material/Image";
import {
  CircularProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { useStorytellerLores } from "@/apis/storyteller.ts";
import {
  ungroupedId,
  type SelectedItem,
  type WorkspaceSection,
} from "./ProjectWorkspacePreviewTypes.ts";
import type { StorytellerStory } from "@/types/storyteller.ts";

type SidebarSelectedItem = { type: SelectedItem["type"]; publicId: string };
type SelectSidebarItem = (item: SelectedItem, collectionId: string) => void;

type SidebarRowData = {
  id: string;
  stories?: StorytellerStory[];
};

export function SidebarCollectionChildren({
  row,
  section,
  projectPublicId,
  selectedItem,
  onSelectItem,
}: {
  row: SidebarRowData;
  section: WorkspaceSection;
  projectPublicId?: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
}) {
  if (section === "stories") {
    return (
      <SidebarStoryChildren
        stories={row.stories ?? []}
        collectionId={row.id}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
      />
    );
  }
  if (section === "lores") {
    return (
      <SidebarLoreChildren
        projectPublicId={projectPublicId}
        collectionId={row.id}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
      />
    );
  }
  return null;
}

function SidebarStoryChildren({
  stories,
  collectionId,
  selectedItem,
  onSelectItem,
}: {
  stories: StorytellerStory[];
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
}) {
  return (
    <List dense disablePadding sx={sidebarChildListSx}>
      {stories.map((story) => (
        <SidebarTreeItem
          key={story.public_id}
          title={story.title}
          icon={
            story.content_type === "image" ? (
              <ImageIcon fontSize="small" />
            ) : (
              <ArticleIcon fontSize="small" />
            )
          }
          selected={
            selectedItem?.type === "story" &&
            selectedItem.publicId === story.public_id
          }
          onClick={() =>
            onSelectItem({ type: "story", row: story }, collectionId)
          }
        />
      ))}
    </List>
  );
}

function SidebarLoreChildren({
  projectPublicId,
  collectionId,
  selectedItem,
  onSelectItem,
}: {
  projectPublicId?: string;
  collectionId: string;
  selectedItem?: SidebarSelectedItem;
  onSelectItem: SelectSidebarItem;
}) {
  const loresQuery = useStorytellerLores(projectPublicId);
  const lores = (loresQuery.data ?? []).filter((lore) =>
    collectionId === ungroupedId
      ? !lore.collection_id
      : lore.collection_id === collectionId,
  );
  return (
    <SidebarAsyncChildren loading={loresQuery.isLoading}>
      {lores.map((lore) => (
        <SidebarTreeItem
          key={lore.public_id}
          title={lore.title}
          icon={<DescriptionIcon fontSize="small" />}
          selected={
            selectedItem?.type === "lore" &&
            selectedItem.publicId === lore.public_id
          }
          onClick={() => onSelectItem({ type: "lore", row: lore }, collectionId)}
        />
      ))}
    </SidebarAsyncChildren>
  );
}

function SidebarAsyncChildren({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 0.75, pl: 5.25 }}>
        <CircularProgress size={16} />
      </Stack>
    );
  }
  return (
    <List dense disablePadding sx={sidebarChildListSx}>
      {children}
    </List>
  );
}

function SidebarTreeItem({
  title,
  icon,
  selected,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <ListItemButton selected={selected} onClick={onClick} sx={sidebarChildRowSx}>
      <ListItemIcon
        sx={{
          minWidth: 24,
          color: selected ? "primary.main" : "inherit",
        }}
      >
        {icon}
      </ListItemIcon>
      <ListItemText
        primary={
          <Tooltip title={title} placement="right">
            <Typography fontWeight={700} fontSize={12.5} noWrap>
              {title}
            </Typography>
          </Tooltip>
        }
        sx={{ minWidth: 0 }}
      />
    </ListItemButton>
  );
}

const sidebarChildListSx: SxProps<Theme> = {
  py: 0.25,
};

const sidebarChildRowSx: SxProps<Theme> = {
  borderRadius: 1,
  my: 0.125,
  minHeight: 28,
  ml: 3.75,
  mr: 0.5,
  pr: 0.75,
  color: "text.secondary",
  "&:hover": {
    bgcolor: (theme) => (theme.palette.mode === "dark" ? "#2b2b2b" : "#ecebe8"),
  },
  "&.Mui-selected": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
    color: "text.primary",
  },
  "&.Mui-selected:hover": {
    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
  },
};
