import AllInboxIcon from "@mui/icons-material/AllInbox";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import ChatIcon from "@mui/icons-material/Chat";
import CollectionsIcon from "@mui/icons-material/Collections";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import SettingsIcon from "@mui/icons-material/Settings";
import { Box, Divider, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentItem, Workspace } from "@writer/lib/backend.ts";
import { CreateDialog } from "@writer/pages/workspace/CreateDialog.tsx";
import { MoveMenuButton, SectionActions, SortArrows } from "@writer/pages/workspace/SidebarActions.tsx";
import type { ListSection } from "@writer/pages/workspace/ListPanels.tsx";
import { GroupRow, NavRow, SidebarSection } from "@writer/pages/workspace/SidebarRows.tsx";
import { UploadDialog } from "@writer/pages/workspace/UploadDialog.tsx";
import type { useWorkspaceEditing } from "@writer/pages/workspace/useWorkspaceEditing.ts";
import { groupIdOf, groupTargets } from "@writer/pages/workspace/workspaceTree.ts";

type Props = {
  workspace: Workspace;
  selected: DocumentItem | null;
  onSelect: (item: DocumentItem) => void;
  onAssistant: () => void;
  // 目前打開的「全部作品／全部設定／全部資產」頁，沒有則為 null
  listSection: ListSection | null;
  onList: (section: ListSection) => void;
  editing: ReturnType<typeof useWorkspaceEditing>;
  // 建立的是故事類或設定時，外層據此打開新項目
  onCreated: (item: DocumentItem) => void;
};

// 各區塊「建立」選單的項目，比照網站
const storyKinds = ["story", "image", "volume"];
const loreKinds = ["lore", "lore-collection"];
const assetKinds = ["asset-collection", "asset-upload"];

// 專案工作台側邊列：最上方是 AI 助理，下面是作品與冊、設定集、資產集、梭梭的記憶。
// 「作品與冊」「設定集」可以切換排序模式（上移／下移）；平常滑過文件會出現 ⋮ 可移動到其他冊／設定集。
export function WorkspaceSidebar({ workspace, selected, onSelect, onAssistant, listSection, onList, editing, onCreated }: Props) {
  const { t } = useTranslation();
  const [sortingStories, setSortingStories] = useState(false);
  const [sortingLores, setSortingLores] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // 「上傳資產」不是建立對話框，另外開上傳對話框
  const onCreate = (kind: string) => (kind === "asset-upload" ? setUploading(true) : setCreating(kind));
  const volumes = workspace.volumes ?? [];
  const loreCollections = workspace.lore_collections ?? [];
  const ungroupedStories = workspace.ungrouped_stories ?? [];
  const uncategorizedLores = workspace.uncategorized_lores ?? [];
  const volumeTargets = groupTargets(workspace, "story", t("workspace.ungroupedStories"));
  const collectionTargets = groupTargets(workspace, "lore", t("workspace.uncategorizedLores"));

  // 文件右側：排序模式顯示上移／下移，平常顯示「移動到…」選單
  const storyExtra = (groupId: string, count: number) => (item: DocumentItem, index: number) =>
    sortingStories ? (
      <SortArrows index={index} count={count} onMove={(delta) => editing.moveStory(groupId, index, delta)} />
    ) : (
      <MoveMenuButton title={t("workspace.actions.moveStory")} targets={volumeTargets} current={groupId} onMove={(volume) => editing.moveStoryTo(item.public_id, volume)} />
    );
  const loreExtra = (groupId: string) => (item: DocumentItem) =>
    sortingLores ? undefined : (
      <MoveMenuButton title={t("workspace.actions.moveLore")} targets={collectionTargets} current={groupId} onMove={(collection) => editing.moveLoreTo(item.public_id, collection)} />
    );

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
        <NavRow icon={<AllInboxIcon />} label={t("workspace.all.assets")} selected={listSection === "assets"} onClick={() => onList("assets")} />
        {(workspace.asset_collections ?? []).map((collection) => (
          <GroupRow key={collection.public_id} name={collection.name} selected={selected} />
        ))}
      </SidebarSection>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.5, py: 1, color: "text.secondary" }}>
        <LightbulbIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" fontWeight={500}>
          {t("workspace.sections.memories")}
        </Typography>
      </Box>
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
