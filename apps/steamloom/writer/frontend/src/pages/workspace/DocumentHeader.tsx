import {
  WorkspaceEditableSummary,
  WorkspaceEditableTitle,
  WorkspaceEditorHeaderRow,
  WorkspaceEditorMultiSelectButton,
  WorkspaceEditorSelectButton,
} from "@/pages/storyteller/ProjectWorkspaceEditorControls.tsx";
import { useEditorLores } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import { publishLoreLinkWarning } from "@/pages/storyteller/storytellerLoreLinkCheck.ts";
import { publicationStatusOptions } from "@/pages/storyteller/workspaceEditorOptions.ts";
import type { StorytellerLore } from "@/types/storyteller.ts";
import FolderIcon from "@mui/icons-material/Folder";
import PersonIcon from "@mui/icons-material/Person";
import { Alert, Button, Stack } from "@mui/material";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import type { DocumentItem, Profile } from "@writer/lib/backend.ts";
import type { DocumentDraftState } from "@writer/pages/workspace/useDocumentDraft.ts";
import type { MoveTarget } from "@writer/pages/workspace/workspaceTree.ts";

// 編輯頁上方：版本衝突提示、標題、屬性列（狀態、冊／設定集、署名）、摘要，文字作品與圖像作品共用，
// 比照網站 StoryEditor／LoreEditor／ImageEpisodeEditor 的 embedded 版面。屬性一變更就 PATCH 即時存，不進編輯歷史。
export function DocumentHeader({
  project,
  item,
  variant,
  state,
  profile,
  groupTargets,
  warningSource,
  actions,
  extraControls,
  onShowHistory,
}: {
  project: string;
  item: DocumentItem;
  // 標題／摘要的 placeholder 跟著種類換（圖像作品跟網站一樣叫「描述」）
  variant: "story" | "lore" | "image";
  state: DocumentDraftState;
  profile: Profile | null;
  // 可選的冊／設定集（第一個是未分冊／未歸類）
  groupTargets: MoveTarget[];
  // 切成公開時要檢查設定連結的文字（文字作品是內文、圖像作品是各頁描述）
  warningSource: string;
  // 標題列右側的動作（圖像作品的存檔按鈕）
  actions?: ReactNode;
  // 屬性列最後的額外控制（文字作品的自動存檔設定）
  extraControls?: ReactNode;
  onShowHistory: () => void;
}) {
  const { t } = useTranslation();
  const { showWarning } = useSnack();
  const { draft, setDraft, changeAttributes, conflict, dismissConflict } = state;
  const { data: lores } = useEditorLores(project);
  const status = publicationStatusOptions.find((option) => option.value === draft.status) ?? publicationStatusOptions[0];
  const groupOptions = groupTargets.map((target) => ({ value: target.publicId, label: target.name, icon: <FolderIcon fontSize="small" /> }));
  // 署名選項比照網站：本人（筆名）＋其他筆名
  const profileOptions = [
    { value: "0", label: profile?.pen_name ? t("workspace.editor.self", { penName: profile.pen_name }) : t("workspace.editor.selfOnly") },
    ...(profile?.profiles ?? []).map((each) => ({ value: String(each.id), label: each.pen_name })),
  ].map((option) => ({ ...option, icon: <PersonIcon fontSize="small" /> }));
  const changeStatus = (next: string) => {
    void changeAttributes({ status: next });
    // 公開時提醒：內容連到還沒公開或已刪除的設定（不擋存檔）；只用到 public_id／title／status
    const warning = next === "completed" ? publishLoreLinkWarning(warningSource, (lores ?? []) as StorytellerLore[]) : undefined;
    if (warning) showWarning(warning);
  };

  return (
    <Stack spacing={1.25} sx={{ flex: "none", width: 1, maxWidth: 920, mx: "auto", pb: 1 }}>
      {conflict && (
        <Alert
          severity="warning"
          variant="outlined"
          onClose={dismissConflict}
          action={
            // 圖像作品沒有編輯歷史可看，只留提示
            variant !== "image" && (
              <Button
                size="small"
                onClick={() => {
                  dismissConflict();
                  onShowHistory();
                }}
              >
                {t("workspace.editor.conflict.viewHistory")}
              </Button>
            )
          }
        >
          {t(`workspace.editor.conflict.${item.kind}`)}
        </Alert>
      )}
      <WorkspaceEditorHeaderRow
        title={<WorkspaceEditableTitle value={draft.title} onChange={(title) => setDraft({ title })} placeholder={t(`workspace.editor.titlePlaceholder.${variant}`)} />}
        actions={actions}
      />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <WorkspaceEditorSelectButton icon={status.icon} label={t("workspace.editor.status")} value={draft.status} options={publicationStatusOptions} onChange={changeStatus} />
        {/* 沒有冊／設定集（只剩未分冊／未歸類）、沒有其他筆名時沒得選，停用 */}
        <WorkspaceEditorSelectButton
          icon={<FolderIcon fontSize="small" />}
          label={t(`workspace.editor.group.${item.kind}`)}
          value={draft.groupId}
          options={groupOptions}
          disabled={groupOptions.length <= 1}
          onChange={(next) => void changeAttributes({ groupId: next })}
        />
        {item.kind === "story" && (
          <WorkspaceEditorMultiSelectButton
            icon={<PersonIcon fontSize="small" />}
            label={t("workspace.editor.authors")}
            values={draft.profileIds.map(String)}
            options={profileOptions}
            disabled={profileOptions.length <= 1}
            onChange={(values) => void changeAttributes({ profileIds: values.map(Number) })}
          />
        )}
        {extraControls}
      </Stack>
      <WorkspaceEditableSummary value={draft.summary} onChange={(summary) => setDraft({ summary })} placeholder={t(`workspace.editor.summaryPlaceholder.${variant}`)} />
    </Stack>
  );
}
