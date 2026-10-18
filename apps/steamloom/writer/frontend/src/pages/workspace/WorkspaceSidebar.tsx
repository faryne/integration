import { WorkspaceRowActionButton } from "@/pages/storyteller/ProjectWorkspaceRowActions.tsx";
import { WorkspaceRailButton } from "@/pages/storyteller/WorkspaceSidebarChrome.tsx";
import { WorkspaceSearchField } from "@/pages/storyteller/WorkspaceSearchField.tsx";
import AllInboxIcon from "@mui/icons-material/AllInbox";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import ChatIcon from "@mui/icons-material/Chat";
import CollectionsIcon from "@mui/icons-material/Collections";
import FolderIcon from "@mui/icons-material/Folder";
import PsychologyAltOutlinedIcon from "@mui/icons-material/PsychologyAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, Divider, Stack } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { UNCATEGORIZED_ASSETS, type DocumentItem, type Workspace } from "@writer/lib/backend.ts";
import { CreateDialog } from "@writer/pages/workspace/CreateDialog.tsx";
import { SectionActions, SortArrows } from "@writer/pages/workspace/SidebarActions.tsx";
import type { ListSection } from "@writer/pages/workspace/ListPanels.tsx";
import { GroupRow, NavRow, SidebarSection } from "@writer/pages/workspace/SidebarRows.tsx";
import { UploadDialog } from "@writer/pages/workspace/UploadDialog.tsx";
import { useDocumentRowActions, type RowActionTarget } from "@writer/pages/workspace/useDocumentRowActions.tsx";
import type { useWorkspaceEditing } from "@writer/pages/workspace/useWorkspaceEditing.ts";
import { groupIdOf, groupTargets } from "@writer/pages/workspace/workspaceTree.ts";

type Props = {
  project: string;
  workspace: Workspace;
  selected: DocumentItem | null;
  onSelect: (item: DocumentItem) => void;
  onAssistant: () => void;
  // 目前打開的「全部作品／全部設定／全部資產」頁，沒有則為 null；資產另外有篩選（資產集／未分類）
  listSection: ListSection | null;
  assetCollection: string;
  onList: (section: ListSection, collection?: string) => void;
  editing: ReturnType<typeof useWorkspaceEditing>;
  // 建立的是故事類或設定時，外層據此打開新項目
  onCreated: (item: DocumentItem) => void;
  // ⋮ 選單改了狀態／移動／刪除後重抓；刪掉的若是正在編輯的那篇，外層要離開編輯頁
  onChanged: () => void;
  onDeleted: (target: RowActionTarget) => void;
  // 掛載時直接打開的建立對話框（剛建立專案後的「建立第一篇故事」）
  initialCreate?: string;
  // 側邊列頂端的專案搜尋（比照網站），送出後由外層打開搜尋對話框
  onSearch: (keyword: string) => void;
};

// 各區塊「建立」選單的項目，比照網站
const storyKinds = ["story", "image", "volume"];
const loreKinds = ["lore", "lore-collection"];
const assetKinds = ["asset-collection", "asset-upload"];

// 專案工作台側邊列：最上方是 AI 助理，下面是作品與冊、設定集、資產集，最後是梭梭的記憶（記憶管理頁）。
// 「作品與冊」「設定集」可以切換排序模式（上移／下移）；平常滑過文件會出現 ⋮，跟「全部作品／全部設定」列表同一份選單。
export function WorkspaceSidebar({ project, workspace, selected, onSelect, onAssistant, listSection, assetCollection, onList, editing, onCreated, onChanged, onDeleted, initialCreate, onSearch }: Props) {
  const { t } = useTranslation();
  const [sortingStories, setSortingStories] = useState(false);
  const [sortingLores, setSortingLores] = useState(false);
  const [creating, setCreating] = useState<string | null>(initialCreate ?? null);
  const [uploading, setUploading] = useState(false);
  // 「上傳資產」不是建立對話框，另外開上傳對話框
  const onCreate = (kind: string) => (kind === "asset-upload" ? setUploading(true) : setCreating(kind));
  const volumes = workspace.volumes ?? [];
  const loreCollections = workspace.lore_collections ?? [];
  const ungroupedStories = workspace.ungrouped_stories ?? [];
  const uncategorizedLores = workspace.uncategorized_lores ?? [];
  const volumeTargets = groupTargets(workspace, "story", t("workspace.ungroupedStories"));
  const collectionTargets = groupTargets(workspace, "lore", t("workspace.uncategorizedLores"));

  const rowActions = useDocumentRowActions({
    project,
    groupsOf: (kind) => (kind === "story" ? volumes : loreCollections),
    onChanged,
    onDeleted,
  });
  // 文件右側：排序模式顯示上移／下移，平常顯示 ⋮
  const actionButton = (item: DocumentItem, groupId: string) => (
    <WorkspaceRowActionButton dense label={t(`workspace.list.actions.${item.kind}`)} onOpen={(event) => rowActions.open(event.currentTarget, { ...item, group_id: groupId })} />
  );
  const storyExtra = (groupId: string, count: number) => (item: DocumentItem, index: number) =>
    sortingStories ? <SortArrows index={index} count={count} onMove={(delta) => editing.moveStory(groupId, index, delta)} /> : actionButton(item, groupId);
  const loreExtra = (groupId: string) => (item: DocumentItem) => (sortingLores ? undefined : actionButton(item, groupId));

  // 建立對話框：故事／圖像作品可選冊、設定可選設定集，預設放在目前選取文件的同一組
  const isStoryKind = creating === "story" || creating === "image";
  const dialogGroups = isStoryKind ? volumeTargets : creating === "lore" ? collectionTargets : undefined;
  const sameKindSelected = selected && ((isStoryKind && selected.kind === "story") || (creating === "lore" && selected.kind === "lore"));
  const submitCreate = async (name: string, group: string) => {
    const created = await editing.create(creating!, name, group);
    if (created?.kind) {
      onCreated({ kind: created.kind, public_id: created.public_id, title: name, content_type: creating === "image" ? "image" : "text" });
    }
    return created !== null;
  };

  return (
    <Box component="nav" sx={{ width: 248, flex: "none", borderRight: 1, borderColor: "divider", overflow: "auto", py: 0.5 }}>
      {/* 比照網站：側邊列頂端的專案搜尋，Enter 後開搜尋對話框（⌘K／Ctrl+K 也能開） */}
      <Box sx={{ pb: 0.5 }}>
        <WorkspaceSearchField onSubmit={onSearch} />
      </Box>
      <NavRow icon={<ChatIcon />} label={t("workspace.assistant")} selected={selected === null && listSection === null} onClick={onAssistant} />
      <Divider />
      <SidebarSection
        icon={<AutoStoriesIcon />}
        title={t("workspace.sections.stories")}
        actions={<SectionActions sorting={sortingStories} onToggleSort={() => setSortingStories(!sortingStories)} createKinds={storyKinds} onCreate={onCreate} />}
      >
        <NavRow icon={<AllInboxIcon />} label={t("workspace.all.stories")} selected={listSection === "stories"} onClick={() => onList("stories")} />
        {volumes.map((volume, index) => (
          <GroupRow
            key={volume.public_id}
            name={volume.name}
            items={volume.items ?? []}
            selected={selected}
            onSelect={onSelect}
            extraAlways={sortingStories}
            extra={sortingStories && <SortArrows index={index} count={volumes.length} onMove={(delta) => editing.moveVolume(index, delta)} />}
            itemExtra={storyExtra(volume.public_id, (volume.items ?? []).length)}
          />
        ))}
        {ungroupedStories.length > 0 && (
          <GroupRow
            name={t("workspace.ungroupedStories")}
            items={ungroupedStories}
            selected={selected}
            onSelect={onSelect}
            extraAlways={sortingStories}
            itemExtra={storyExtra("", ungroupedStories.length)}
          />
        )}
      </SidebarSection>
      <SidebarSection
        icon={<SettingsIcon />}
        title={t("workspace.sections.lores")}
        actions={
          <SectionActions
            sorting={sortingLores}
            onToggleSort={loreCollections.length > 1 ? () => setSortingLores(!sortingLores) : undefined}
            createKinds={loreKinds}
            onCreate={onCreate}
          />
        }
      >
        <NavRow icon={<AllInboxIcon />} label={t("workspace.all.lores")} selected={listSection === "lores"} onClick={() => onList("lores")} />
        {loreCollections.map((collection, index) => (
          <GroupRow
            key={collection.public_id}
            name={collection.name}
            items={collection.items ?? []}
            selected={selected}
            onSelect={onSelect}
            extraAlways={sortingLores}
            extra={sortingLores && <SortArrows index={index} count={loreCollections.length} onMove={(delta) => editing.moveLoreCollection(index, delta)} />}
            itemExtra={loreExtra(collection.public_id)}
          />
        ))}
        {uncategorizedLores.length > 0 && (
          <GroupRow name={t("workspace.uncategorizedLores")} items={uncategorizedLores} selected={selected} onSelect={onSelect} itemExtra={loreExtra("")} />
        )}
      </SidebarSection>
      <SidebarSection icon={<CollectionsIcon />} title={t("workspace.sections.assets")} actions={<SectionActions createKinds={assetKinds} onCreate={onCreate} />}>
        {/* 比照網站：全部資產、未分類、各資產集都可以點，打開對應的資產列表 */}
        {[
          { id: "", icon: <AllInboxIcon />, label: t("workspace.all.assets") },
          { id: UNCATEGORIZED_ASSETS, icon: <FolderIcon />, label: t("workspace.upload.uncategorized") },
          ...(workspace.asset_collections ?? []).map((collection) => ({ id: collection.public_id, icon: <FolderIcon />, label: collection.name })),
        ].map((row) => (
          <NavRow key={row.id || "all"} icon={row.icon} label={row.label} selected={listSection === "assets" && assetCollection === row.id} onClick={() => onList("assets", row.id)} />
        ))}
      </SidebarSection>
      {/* 比照網站：記憶管理是專案層的頁面，不屬於任何分組；圖示跟網站 workspaceToolPages 同一個 */}
      <NavRow icon={<PsychologyAltOutlinedIcon />} label={t("workspace.sections.memories")} selected={listSection === "memories"} onClick={() => onList("memories")} />
      {uploading && (
        <UploadDialog
          collections={[
            { publicId: "", name: t("workspace.upload.uncategorized") },
            ...(workspace.asset_collections ?? []).map((collection) => ({ publicId: collection.public_id, name: collection.name })),
          ]}
          onClose={() => setUploading(false)}
          onUpload={async (collection) => {
            const done = await editing.upload(collection);
            // 上傳完直接帶到「全部資產」，看得到剛傳上去的圖
            if (done) onList("assets");
            return done;
          }}
        />
      )}
      {rowActions.dialogs}
      {creating && (
        <CreateDialog
          kind={creating}
          groups={dialogGroups}
          groupLabel={t(isStoryKind ? "workspace.create.volume" : "workspace.create.collection")}
          defaultGroup={sameKindSelected ? groupIdOf(workspace, selected) : ""}
          onClose={() => setCreating(null)}
          onSubmit={submitCreate}
        />
      )}
    </Box>
  );
}

// 側邊列收合後的 52px 窄欄（比照網站）：AI 助理、三個「全部…」列表與梭梭的記憶的入口，滑過顯示名稱
export function WorkspaceSidebarRail({
  selected,
  listSection,
  onAssistant,
  onList,
  onSearch,
}: Pick<Props, "selected" | "listSection" | "onAssistant" | "onList" | "onSearch">) {
  const { t } = useTranslation();
  // 編輯中的文件也算在它那一區
  const current = listSection ?? (selected?.kind === "story" ? "stories" : selected?.kind === "lore" ? "lores" : null);
  const sections = [
    { section: "stories" as const, icon: <AutoStoriesIcon /> },
    { section: "lores" as const, icon: <SettingsIcon /> },
    { section: "assets" as const, icon: <CollectionsIcon /> },
    { section: "memories" as const, icon: <PsychologyAltOutlinedIcon /> },
  ];
  return (
    <Stack component="nav" alignItems="center" spacing={0.5} sx={{ width: 52, flex: "none", borderRight: 1, borderColor: "divider", pt: 5.5 }}>
      <WorkspaceRailButton icon={<SearchIcon />} label={t("workspace.search")} selected={false} onClick={() => onSearch("")} />
      <WorkspaceRailButton icon={<ChatIcon />} label={t("workspace.assistant")} selected={current === null} onClick={onAssistant} />
      {sections.map(({ section, icon }) => (
        <WorkspaceRailButton key={section} icon={icon} label={t(`workspace.all.${section}`)} selected={current === section} onClick={() => onList(section)} />
      ))}
    </Stack>
  );
}
