import ArticleIcon from "@mui/icons-material/Article";
import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import ChecklistIcon from "@mui/icons-material/Checklist";
import CollectionsIcon from "@mui/icons-material/Collections";
import FolderIcon from "@mui/icons-material/Folder";
import PersonIcon from "@mui/icons-material/Person";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Alert, Button, Stack } from "@mui/material";
import type { ReactNode } from "react";
import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorMetaPanel,
  WorkspaceEditorMultiSelectButton,
  WorkspaceEditorSelectButton,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { useEditorLores } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { publishLoreLinkWarning } from "@/pages/storyteller/storytellerLoreLinkCheck.ts";
import {
  publicationStatusOptions,
  selectedOptionLabel,
  selectedOptionsLabel,
} from "@/pages/storyteller/workspaceEditorOptions.ts";
import type { StorytellerLore } from "@/types/storyteller.ts";
import type { DocumentEditorLabels } from "@/pages/storyteller/documentEditor/documentEditorLabels.ts";
import type {
  DocumentEditingState,
  DocumentKind,
  DocumentNotify,
  PublicationStatus,
} from "@/pages/storyteller/documentEditor/useDocumentEditing.ts";

export interface DocumentGroupOption {
  publicId: string;
  name: string;
}

export interface DocumentDependencyOption {
  kind: DocumentKind;
  publicId: string;
  title: string;
  // 圖像作品用不同的圖示
  image?: boolean;
}

// 編輯頁上方（網站 StoryEditor／LoreEditor 與 SteamLoom Writer 共用）：版本衝突提示、標題、
// 屬性列（狀態、冊／設定集、故事的署名、設定的劇透與「需先讀過」）、摘要。屬性一變更就 PATCH 即時存，不進編輯歷史；
// 劇透與依賴跟內文一起存。手機版屬性列收成一行（WorkspaceEditorMetaPanel）。
export function DocumentEditorHeader({
  kind,
  projectPublicId,
  editing,
  labels,
  groups,
  penName,
  profiles,
  dependencyOptions,
  extraControls,
  actions,
  saveFailed,
  warningSource,
  notify,
  onShowHistory,
}: {
  kind: DocumentKind;
  projectPublicId?: string;
  editing: DocumentEditingState;
  labels: DocumentEditorLabels;
  // 可選的冊／設定集（不含未分冊／未歸類，這裡會自己補在最前面）
  groups: DocumentGroupOption[];
  penName?: string;
  // 本人以外的筆名（故事署名的選項；本人固定是 0）
  profiles: { id: number; pen_name: string }[];
  dependencyOptions: DocumentDependencyOption[];
  // 屬性列最後的額外控制（自動存檔）
  extraControls?: ReactNode;
  // 標題列右側的動作
  actions?: ReactNode;
  // 上一次存檔失敗（沒有衝突提示時才顯示）
  saveFailed?: boolean;
  // 切成公開時檢查設定連結的文字，預設是內文（圖像作品傳各頁描述）
  warningSource?: string;
  notify: DocumentNotify;
  // 沒給就不顯示「查看編輯歷史」（例如還沒有歷史的新文件）
  onShowHistory?: () => void;
}) {
  const { draft, setDraft, changeAttributes, conflict, dismissConflict } =
    editing;
  const { data: lores } = useEditorLores(projectPublicId);
  const statusIcon = (status: string) =>
    status === "completed" ? (
      <VisibilityIcon fontSize="small" />
    ) : (
      <VisibilityOffIcon fontSize="small" />
    );
  const groupOptions = [
    { publicId: "", name: labels.ungrouped },
    ...groups,
  ].map((group) => ({
    value: group.publicId,
    label: group.name,
    icon: <FolderIcon fontSize="small" />,
  }));
  const profileOptions = [
    { value: "0", label: labels.self(penName) },
    ...profiles.map((profile) => ({
      value: String(profile.id),
      label: profile.pen_name,
    })),
  ].map((option) => ({ ...option, icon: <PersonIcon fontSize="small" /> }));
  const spoilerOptions = [
    {
      value: "no",
      label: labels.spoilerNo,
      icon: <VisibilityIcon fontSize="small" />,
    },
    {
      value: "yes",
      label: labels.spoilerYes,
      icon: <ReportProblemOutlinedIcon fontSize="small" />,
    },
  ];
  // 依賴可以是同專案的故事或其他設定；草稿與未公開的也列出來，作者可以先設好再公開
  const dependencySelectOptions = dependencyOptions.map((option) => ({
    value: `${option.kind}:${option.publicId}`,
    label: `${option.kind === "story" ? labels.dependencyStory : labels.dependencyLore}・${option.title}`,
    icon:
      option.kind === "lore" ? (
        <AutoStoriesIcon fontSize="small" />
      ) : option.image ? (
        <CollectionsIcon fontSize="small" />
      ) : (
        <ArticleIcon fontSize="small" />
      ),
  }));
  const changeStatus = (next: string) => {
    void changeAttributes({ status: next as PublicationStatus });
    // 公開時提醒：內文連到還沒公開或已刪除的設定（不擋存檔）；只用到 public_id／title／status
    const warning =
      next === "completed"
        ? publishLoreLinkWarning(
            warningSource ?? draft.content,
            (lores ?? []) as StorytellerLore[],
          )
        : undefined;
    if (warning) notify(warning, "warning");
  };

  return (
    <Stack spacing={1.25} sx={{ width: 1, maxWidth: 920, mx: "auto" }}>
      {conflict ? (
        <Alert
          severity="warning"
          variant="outlined"
          onClose={dismissConflict}
          action={
            onShowHistory && (
              <Button
                size="small"
                onClick={() => {
                  dismissConflict();
                  onShowHistory();
                }}
              >
                {labels.viewHistory}
              </Button>
            )
          }
        >
          {labels.conflict}
        </Alert>
      ) : (
        saveFailed && (
          <Alert severity="error" variant="outlined">
            {labels.saveFailedBanner}
          </Alert>
        )
      )}
      <WorkspaceEditorHeaderRow
        title={
          <WorkspaceEditableTitle
            value={draft.title}
            onChange={(title) => setDraft({ title })}
            placeholder={labels.titlePlaceholder}
          />
        }
        actions={actions}
      />
      <WorkspaceEditorMetaPanel
        items={[
          {
            icon: statusIcon(draft.status),
            text: selectedOptionLabel(publicationStatusOptions, draft.status),
          },
          {
            icon: <FolderIcon />,
            text: selectedOptionLabel(groupOptions, draft.groupId),
          },
          ...(kind === "story"
            ? [
                {
                  icon: <PersonIcon />,
                  text: selectedOptionsLabel(
                    profileOptions,
                    draft.profileIds.map(String),
                  ),
                },
              ]
            : []),
        ]}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <WorkspaceEditorSelectButton
            icon={statusIcon(draft.status)}
            label={labels.status}
            value={draft.status}
            options={publicationStatusOptions}
            onChange={changeStatus}
          />
          {/* 沒有冊／設定集（只剩未分冊／未歸類）、沒有其他筆名時沒得選，停用 */}
          <WorkspaceEditorSelectButton
            icon={<FolderIcon fontSize="small" />}
            label={labels.group}
            value={draft.groupId}
            options={groupOptions}
            disabled={groupOptions.length <= 1}
            onChange={(next) => void changeAttributes({ groupId: next })}
          />
          {kind === "story" && (
            <WorkspaceEditorMultiSelectButton
              icon={<PersonIcon fontSize="small" />}
              label={labels.authors}
              values={draft.profileIds.map(String)}
              options={profileOptions}
              disabled={profileOptions.length <= 1}
              onChange={(values) =>
                void changeAttributes({ profileIds: values.map(Number) })
              }
            />
          )}
          {kind === "lore" && (
            <>
              <WorkspaceEditorSelectButton
                icon={
                  draft.isSpoiler ? (
                    <ReportProblemOutlinedIcon fontSize="small" />
                  ) : (
                    <VisibilityIcon fontSize="small" />
                  )
                }
                label={labels.spoiler}
                value={draft.isSpoiler ? "yes" : "no"}
                options={spoilerOptions}
                onChange={(value) => setDraft({ isSpoiler: value === "yes" })}
              />
              {/* 含劇透時才需要選「需先讀過」哪些故事或設定 */}
              {draft.isSpoiler && (
                <WorkspaceEditorMultiSelectButton
                  icon={<ChecklistIcon fontSize="small" />}
                  label={labels.dependsOn}
                  values={draft.dependsOn}
                  options={dependencySelectOptions}
                  onChange={(dependsOn) => setDraft({ dependsOn })}
                />
              )}
            </>
          )}
          {extraControls}
        </Stack>
        <WorkspaceEditableSummary
          value={draft.summary}
          onChange={(summary) => setDraft({ summary })}
          placeholder={labels.summaryPlaceholder}
        />
      </WorkspaceEditorMetaPanel>
    </Stack>
  );
}
