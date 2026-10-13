import { ShortcutHint } from "@/components/common/ShortcutHint.tsx";
import { ImageEpisodePageList } from "@/pages/storyteller/ImageEpisodePageList.tsx";
import { StorytellerAssetDropzone } from "@/pages/storyteller/StorytellerAssetDropzone.tsx";
import { StorytellerAssetPickerDialog } from "@/pages/storyteller/StorytellerAssetPickerDialog.tsx";
import type { EditorPickerAsset } from "@/pages/storyteller/StorytellerEditorDataContext.ts";
import CollectionsIcon from "@mui/icons-material/Collections";
import { Alert, Box, Button, CircularProgress, LinearProgress, Stack } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, type Document } from "@writer/lib/backend.ts";
import { useBackendData } from "@writer/lib/useBackendData.ts";
import { DocumentHeader } from "@writer/pages/workspace/DocumentHeader.tsx";
import type { EditorPanelProps } from "@writer/pages/workspace/EditorPanel.tsx";
import { useDocumentDraft } from "@writer/pages/workspace/useDocumentDraft.ts";

// 圖像作品的一頁：已存在的頁面有 key／assetPublicId；剛選的本機圖只有 localToken（按存檔才上傳，跟網站一樣）
type Page = { id: string; key?: string; assetPublicId?: string; localToken?: string; previewUrl: string; description: string };

// 跟網站 STORYTELLER_IMAGE_PAGE_MAX_COUNT 一致；格式與 15 MB 上限由 Go 端檢查
const MAX_PAGES = 60;
const newPageId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 草稿內容＝後端存的 JSON 格式（StoryImageContent）多一個 local（還沒上傳的本機圖），
// 頁面增刪、排序、描述、加入本機圖都會反映在字串上，未存檔判斷直接沿用 useDocumentDraft。
const serialize = (pages: Page[]) =>
  JSON.stringify({
    pages: pages.map((page, index) => ({
      id: page.id,
      key: page.key || undefined,
      asset_public_id: page.assetPublicId || undefined,
      local: page.localToken || undefined,
      description: page.description,
      sort: index,
    })),
  });

// 圖像作品編輯頁，比照網站 ImageEpisodeEditor 的 embedded 版面：上方標題（右側存檔）、屬性、描述，
// 下方頁面清單（共用 ImageEpisodePageList）。跟網站一樣沒有自動存檔；
// 頁面清單沒載入成功時不給存（不然會把原本的頁面蓋成空的）。
export function ImageDocumentEditor({ project, item, doc, groupId, status, groupTargets, profile, onDirtyChange, onSaved, onShowHistory }: EditorPanelProps & { doc: Document }) {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const loaded = useBackendData(() => backend.ImagePages(project, item.public_id), [project, item.public_id]);
  const [pages, setPagesState] = useState<Page[] | null>(null);
  const pagesRef = useRef<Page[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const setPages = (next: Page[]) => {
    pagesRef.current = next;
    setPagesState(next);
  };

  // 存檔前先上傳本機圖換成資產；部分失敗時保留成功的（重試只傳剩下的），整次存檔中止
  const prepare = async () => {
    if (pagesRef.current.length === 0) throw new Error(t("workspace.image.noPages"));
    const locals = pagesRef.current.filter((page) => page.localToken);
    if (locals.length) {
      const uploaded = await backend.UploadLocalImages(project, locals.map((page) => page.localToken!));
      setPages(pagesRef.current.map((page) => (page.localToken && uploaded[page.localToken] ? { ...page, assetPublicId: uploaded[page.localToken], localToken: undefined } : page)));
      if (pagesRef.current.some((page) => page.localToken)) throw new Error(t("workspace.image.uploadIncomplete"));
    }
    const content = serialize(pagesRef.current);
    return { content, saved: content };
  };
  const state = useDocumentDraft({ project, item, doc, groupId, status, autoSaveMinutes: null, onSaved, onDirtyChange, prepare, reloadOnFocus: false });
  const { draft, setContent, saving, save } = state;

  useEffect(() => {
    if (loaded) setPages(loaded.map((page) => ({ id: page.id, key: page.key || undefined, assetPublicId: page.asset_public_id || undefined, previewUrl: page.image_url, description: page.description })));
  }, [loaded]);
  // 頁面每次變動都同步成草稿內容；載入後的第一次會被當成已存檔的基準
  useEffect(() => {
    if (pages) setContent(serialize(pages));
  }, [pages]);

  const pick = async () => {
    try {
      const result = await backend.PickImageFiles();
      if (!result) return;
      const files = result.files.slice(0, Math.max(0, MAX_PAGES - pagesRef.current.length));
      const reasons = [result.skipped?.length && t("workspace.image.rejected"), result.files.length > files.length && t("workspace.image.tooMany", { max: MAX_PAGES })].filter(Boolean);
      setWarning(reasons.length ? t("workspace.image.partial", { reasons: reasons.join("、") }) : null);
      setPages([...pagesRef.current, ...files.map((file) => ({ id: newPageId(), localToken: file.token, previewUrl: file.preview_url, description: "" }))]);
    } catch (err) {
      showError(errorMessage(err));
    }
  };
  const addAsset = (asset: EditorPickerAsset) => {
    setPickerOpen(false);
    if (pagesRef.current.length >= MAX_PAGES) return setWarning(t("workspace.image.tooMany", { max: MAX_PAGES }));
    setWarning(null);
    setPages([...pagesRef.current, { id: newPageId(), assetPublicId: asset.public_id, previewUrl: asset.preview_url, description: "" }]);
  };
  const updatePages = (update: (current: Page[]) => Page[]) => setPages(update(pagesRef.current));
  const hasLocal = (pages ?? []).some((page) => page.localToken);

  return (
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", px: 2.5, pt: 1.5 }}>
      <DocumentHeader
        project={project}
        item={item}
        variant="image"
        state={state}
        profile={profile}
        groupTargets={groupTargets}
        warningSource={(pages ?? []).map((page) => page.description).join("\n")}
        actions={
          <Button size="small" variant="contained" startIcon={<CollectionsIcon />} disabled={!draft.title.trim() || !pages?.length || saving} onClick={() => void save()}>
            {t(saving ? "workspace.image.saving" : "workspace.image.save")}
            <ShortcutHint shortcutKey="S" />
          </Button>
        }
        onShowHistory={onShowHistory}
      />
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", pb: 3 }}>
        <Stack spacing={2} sx={{ width: 1, maxWidth: 920, mx: "auto" }}>
          {loaded === null && <CircularProgress size={24} />}
          {warning && (
            <Alert severity="warning" variant="outlined" onClose={() => setWarning(null)}>
              {warning}
            </Alert>
          )}
          {/* Go 端上傳沒有逐檔進度，上傳本機圖時顯示不定進度條 */}
          {saving && hasLocal && <LinearProgress />}
          {pages && (
            <ImageEpisodePageList
              pages={pages}
              disabled={saving}
              addControl={<StorytellerAssetDropzone hint={t("workspace.image.pickHint")} disabled={saving} onPick={() => void pick()} />}
              onPickAsset={() => setPickerOpen(true)}
              onMove={(from, to) =>
                updatePages((current) => {
                  const next = [...current];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  return next;
                })
              }
              onRemove={(pageId) => updatePages((current) => current.filter((page) => page.id !== pageId))}
              onDescriptionChange={(pageId, description) => updatePages((current) => current.map((page) => (page.id === pageId ? { ...page, description } : page)))}
            />
          )}
        </Stack>
      </Box>
      <StorytellerAssetPickerDialog open={pickerOpen} projectPublicId={project} title={t("workspace.image.pickerTitle")} onClose={() => setPickerOpen(false)} onSelect={addAsset} />
    </Box>
  );
}
