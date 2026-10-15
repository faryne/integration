import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import ImageIcon from "@mui/icons-material/Image";
import {
  Box,
  Button,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  useMediaQuery,
  useTheme,
  type SxProps,
  type Theme,
} from "@mui/material";
import { useMemo, useRef, useState, type ComponentProps } from "react";
import {
  WorkspaceEditorSaveButton,
  WorkspaceEditorStatusInfo,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import type { EditorPickerAsset } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { StorytellerEditorOutlinePanel } from "@/pages/storyteller/StorytellerEditorOutlinePanel.tsx";
import { StorytellerEditorOutlineToggle } from "@/pages/storyteller/StorytellerEditorOutlineToggle.tsx";
import {
  StorytellerWysiwygEditor,
  type StorytellerWysiwygEditorHandle,
} from "@/pages/storyteller/StorytellerWysiwygEditor.tsx";
import { StoryWritingWorkspace } from "@/pages/storyteller/StoryWritingWorkspace.tsx";
import { storytellerAssetTitle } from "@/pages/storyteller/storytellerAssetMarkdown.ts";
import { contentWordCount } from "@/pages/storyteller/storytellerContentWordCount.ts";
import { useStorytellerEditorOutline } from "@/pages/storyteller/useStorytellerEditorOutline.ts";
import { editorStatusItems } from "@/pages/storyteller/workspaceEditorStatusItems.tsx";
import type { StorytellerLore, StorytellerStory } from "@/types/storyteller.ts";
import {
  DocumentEditorHeader,
  type DocumentDependencyOption,
  type DocumentGroupOption,
} from "@/pages/storyteller/documentEditor/DocumentEditorHeader.tsx";
import { DocumentHistoryPanel } from "@/pages/storyteller/documentEditor/DocumentHistoryPanel.tsx";
import { DocumentScopeChip } from "@/pages/storyteller/documentEditor/DocumentScopeChip.tsx";
import { useDocumentScope } from "@/pages/storyteller/documentEditor/useDocumentScope.ts";
import { EditorAutoSaveButton } from "@/pages/storyteller/documentEditor/EditorAutoSaveButton.tsx";
import type { DocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import type {
  DocumentEditingState,
  DocumentKind,
  DocumentNotify,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

export type DocumentEditorTab = "editor" | "history";

type WysiwygProps = ComponentProps<typeof StorytellerWysiwygEditor>;

// 故事／設定的編輯頁（網站 StoryEditor／LoreEditor 與 SteamLoom Writer 共用，Writer 透過 alias 直接 import）：
// 上方「編輯／編輯歷史」分頁；編輯分頁是頁首（標題、屬性、摘要）＋所見即所得編輯器（工具列有插入資產、大綱與書籤，
// 底部狀態列與存檔），編輯歷史分頁是版本表格（比對、回復）。切到編輯歷史時編輯器不卸載，未存檔內容與游標都留著。
// 草稿與存檔由呼叫端用 useDocumentEditing 建好傳進來（呼叫端還要拿它做離開前確認、AI 套用等）。
// 大綱面板的「只編輯這段」可以只編輯某一章（useDocumentScope），存檔一樣存整篇；範圍模式時分頁列右側有狀態標籤。
export function SteamLoomDocumentEditor({
  kind,
  projectPublicId,
  editing,
  labels,
  notify,
  notifyError,
  groups,
  penName,
  profiles,
  dependencyOptions,
  autoSaveMinutes,
  onAutoSaveMinutesChange,
  tab: controlledTab,
  onTabChange,
  fillHeight = true,
  onBack,
  editorProps,
  sx,
}: {
  kind: DocumentKind;
  projectPublicId?: string;
  editing: DocumentEditingState;
  labels: DocumentEditorLabels;
  notify: DocumentNotify;
  notifyError: (fallback: string, error: unknown) => void;
  groups: DocumentGroupOption[];
  penName?: string;
  profiles: { id: number; pen_name: string }[];
  dependencyOptions: DocumentDependencyOption[];
  autoSaveMinutes: number | null;
  onAutoSaveMinutesChange: (minutes: number | null) => void;
  // 不給就自己管分頁（網站舊版獨立頁要跟網址同步才由外面控制）
  tab?: DocumentEditorTab;
  onTabChange?: (tab: DocumentEditorTab) => void;
  // 填滿父層高度、編輯區自己捲動（工作台與 Writer）；false 時編輯區用固定高度（舊版獨立頁）
  fillHeight?: boolean;
  // 底部狀態列左側的「回列表」
  onBack?: () => void;
  // 額外交給編輯器的屬性（網站的 AI 工作區、Writer 的「問 AI」）
  editorProps?: Partial<WysiwygProps>;
  sx?: SxProps<Theme>;
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [ownTab, setOwnTab] = useState<DocumentEditorTab>("editor");
  const tab = controlledTab ?? ownTab;
  const setTab = (next: DocumentEditorTab) => {
    setOwnTab(next);
    onTabChange?.(next);
  };
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const editorRef = useRef<StorytellerWysiwygEditorHandle>(null);
  const { draft, saving } = editing;
  const publicId = editing.publicId();
  const wordCount = useMemo(
    () => contentWordCount(draft.content),
    [draft.content],
  );
  const outline = useStorytellerEditorOutline({
    projectPublicId,
    storyPublicId: kind === "story" ? publicId : undefined,
    lorePublicId: kind === "lore" ? publicId : undefined,
    onSnack: notify,
  });
  const scope = useDocumentScope({
    editing,
    memoryKey: publicId ? `${kind}:${publicId}` : undefined,
    editor: outline.editor,
  });

  // 書籤存的是段落 markerId，只有真的存進後端的內容下次載入才找得到：段落還沒存檔、
  // 或這篇是剛補過 marker 的舊資料，加書籤前先存一次（兩個請求誰先到不重要，存檔成功 marker 就落地）
  const addBookmark = (markerId: string, note: string) => {
    if (editing.hasUnsavedChanges() || editing.hasUnpersistedMarkers()) {
      void editing.save("manual");
    }
    outline.addBookmark(markerId, note);
  };
  const insertAsset = (asset: EditorPickerAsset) => {
    const inserted = editorRef.current?.insertAsset({
      publicId: asset.public_id,
      src: asset.preview_url,
      alt: asset.alt_text || storytellerAssetTitle(asset),
      projectPublicId,
    });
    setAssetPickerOpen(false);
    notify(
      inserted ? labels.assetInserted : labels.assetInsertFailed,
      inserted ? "success" : "error",
    );
  };
  // 回復版本後換上後端回傳的內容（屬性是即時 PATCH 的，維持現在的值），回到編輯分頁
  const handleReverted = (document: StorytellerStory | StorytellerLore) => {
    const current = editing.draft;
    editing.replaceWith({
      ...current,
      publicId,
      title: document.title,
      summary: document.summary ?? "",
      content: document.latest_content,
      versionId: document.latest_version_id,
      updatedAt: document.updated_at,
      sort: "sort" in document ? document.sort : 0,
      ...("is_spoiler" in document
        ? {
            isSpoiler: Boolean(document.is_spoiler),
            dependsOn: (document.depends_on ?? []).map(
              (each) => `${each.target_type}:${each.target_public_id}`,
            ),
          }
        : {}),
    });
    editing.dismissConflict();
    setTab("editor");
  };
  const compactButtonSx = isMobile ? { p: 0.5 } : undefined;

  return (
    <Box
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          height: fillHeight ? 1 : undefined,
          minHeight: 0,
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack
        direction="row"
        alignItems="flex-end"
        justifyContent="space-between"
        spacing={2}
        sx={{ flex: "none", borderBottom: 1, borderColor: "divider" }}
      >
        <Tabs
          value={tab}
          onChange={(_, value: DocumentEditorTab) => setTab(value)}
          sx={{ minHeight: 42 }}
        >
          {(
            [
              ["editor", <EditIcon key="icon" fontSize="small" />],
              ["history", <HistoryIcon key="icon" fontSize="small" />],
            ] as const
          ).map(([value, icon]) => (
            <Tab
              key={value}
              value={value}
              icon={icon}
              iconPosition="start"
              label={labels.tabs[value]}
              sx={{ minHeight: 42 }}
            />
          ))}
        </Tabs>
        {tab === "editor" && (
          <DocumentScopeChip
            scope={scope.scope}
            label={labels.scope.only}
            backLabel={labels.scope.backToFull}
            onBack={() => scope.select(null)}
          />
        )}
      </Stack>
      <Box
        sx={{
          flex: fillHeight ? 1 : undefined,
          minHeight: 0,
          display: tab === "editor" ? "flex" : "none",
          flexDirection: "column",
          pt: 1.5,
        }}
      >
        <Box sx={{ flex: "none", pb: 1 }}>
          <DocumentEditorHeader
            kind={kind}
            projectPublicId={projectPublicId}
            editing={editing}
            labels={labels}
            groups={groups}
            penName={penName}
            profiles={profiles}
            dependencyOptions={dependencyOptions}
            notify={notify}
            onShowHistory={publicId ? () => setTab("history") : undefined}
            extraControls={
              publicId && (
                <EditorAutoSaveButton
                  minutes={autoSaveMinutes}
                  onChange={onAutoSaveMinutesChange}
                  labels={labels.autoSave}
                />
              )
            }
          />
        </Box>
        <Box sx={{ flex: fillHeight ? 1 : undefined, minHeight: 0, pb: 1.5 }}>
          <StoryWritingWorkspace
            fillHeight={fillHeight}
            editor={
              <StorytellerWysiwygEditor
                ref={editorRef}
                value={scope.value}
                onChange={scope.onChange}
                toolbarPlacement="bottom"
                fitParentHeight={fillHeight}
                bottomStatusContent={
                  <Stack
                    direction="row"
                    spacing={1}
                    flexWrap="wrap"
                    useFlexGap
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    {onBack && (
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<ArrowBackIcon fontSize="small" />}
                        onClick={onBack}
                        // 手機版拿掉：麵包屑與導覽已經能回列表，把底部高度讓給編輯區
                        sx={{
                          flexShrink: 0,
                          color: "text.secondary",
                          display: { xs: "none", sm: "inline-flex" },
                        }}
                      >
                        {labels.backToList}
                      </Button>
                    )}
                    <WorkspaceEditorStatusInfo
                      items={editorStatusItems({
                        wordCount,
                        updatedAt: editing.updatedAt,
                        autoSaveMinutes: publicId ? autoSaveMinutes : undefined,
                      })}
                    />
                  </Stack>
                }
                bottomActionContent={
                  <WorkspaceEditorSaveButton
                    pending={saving}
                    disabled={saving}
                    onClick={() => void editing.save("manual")}
                  />
                }
                exportBaseName={draft.title}
                projectPublicId={projectPublicId}
                hasSavedTarget={Boolean(publicId)}
                caretMemoryKey={publicId ? `${kind}:${publicId}` : undefined}
                onRequestInsertAsset={
                  projectPublicId ? () => setAssetPickerOpen(true) : undefined
                }
                bookmarkedMarkerIds={outline.bookmarkedMarkerIds}
                bookmarkNotesByMarkerId={outline.bookmarkNotesByMarkerId}
                canBookmark={outline.canBookmark}
                onAddBookmark={addBookmark}
                onSaveBookmarkNote={outline.saveBookmarkNote}
                onRemoveBookmark={outline.removeBookmark}
                onEditorReady={outline.onEditorReady}
                toolbarExtra={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title={labels.insertAsset}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={!projectPublicId}
                          onClick={() => setAssetPickerOpen(true)}
                          aria-label={labels.insertAsset}
                          sx={compactButtonSx}
                        >
                          <ImageIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <StorytellerEditorOutlineToggle
                      open={outline.outlineOpen}
                      onToggle={outline.setOutlineOpen}
                    >
                      <StorytellerEditorOutlinePanel
                        editor={outline.editor}
                        content={scope.content}
                        scope={scope.scope}
                        bookmarks={outline.bookmarks}
                        loading={outline.bookmarksLoading}
                        onDeleteBookmark={outline.removeBookmark}
                        onUpdateBookmarkNote={outline.saveBookmarkNote}
                        onEditSection={scope.select}
                        onBackToFull={() => scope.select(null)}
                        onJumpOutside={scope.jumpOutside}
                      />
                    </StorytellerEditorOutlineToggle>
                  </Stack>
                }
                {...editorProps}
              />
            }
          />
        </Box>
      </Box>
      {tab === "history" && (
        <DocumentHistoryPanel
          kind={kind}
          projectPublicId={projectPublicId}
          publicId={publicId}
          itemTitle={draft.title.trim() || labels.titlePlaceholder}
          labels={labels}
          active
          notify={notify}
          notifyError={notifyError}
          onReverted={handleReverted}
        />
      )}
      <StorytellerAssetPickerDialog
        open={assetPickerOpen}
        projectPublicId={projectPublicId}
        title={labels.insertAssetTitle}
        onClose={() => setAssetPickerOpen(false)}
        onSelect={insertAsset}
      />
    </Box>
  );
}
