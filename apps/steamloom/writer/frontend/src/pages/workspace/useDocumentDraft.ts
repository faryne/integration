import { usePrimaryShortcut } from "@/helpers/shortcut.ts";
import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Document, type DocumentItem } from "@writer/lib/backend.ts";
import { SessionExpiredContext } from "@writer/lib/useBackendData.ts";

// groupId 是所在冊（故事）或設定集（設定）的 public_id，空字串＝未分冊／未歸類；profileIds 只有故事用（0＝本人）
export type Draft = { title: string; summary: string; content: string; status: string; groupId: string; profileIds: number[] };

const draftOf = (doc: Document, groupId: string): Draft => ({
  title: doc.title,
  summary: doc.summary ?? "",
  content: doc.latest_content ?? "",
  status: doc.status,
  groupId,
  profileIds: doc.profile_ids?.length ? doc.profile_ids : [0],
});
const sameProfiles = (a: number[], b: number[]) => a.join() === b.join();
const sameDraft = (a: Draft, b: Draft) =>
  a.title === b.title && a.summary === b.summary && a.content === b.content && a.status === b.status && a.groupId === b.groupId && sameProfiles(a.profileIds, b.profileIds);

// 編輯分頁的草稿與存檔，行為比照網站 StoryEditor／LoreEditor（雙胞胎，故事與設定共用這一份）：
// - 手動存檔每次都送（跟網站一樣會多一個版本）；自動存檔只在內容有變、標題不是空白時送。
// - 都帶 base_version_id，後端照樣寫入，但回 version_conflict 時顯示提示，請作者去編輯歷史確認。
// - 視窗重新取得焦點時，沒有未存檔內容就看伺服器上有沒有新版本（網站或 AI 助理改過），有就直接換上。
// 圖像作品也用這一份：內容是頁面清單的 JSON，存檔前由 prepare 先上傳本機圖、換成後端要的格式，
// 而且不在取得焦點時自動換內容（reloadOnFocus=false，頁面清單由圖像編輯頁自己載入）。
// timer／focus 事件裡讀到的都要是最新值，所以草稿、版本另外放 ref。
export function useDocumentDraft({
  project,
  item,
  doc,
  groupId,
  autoSaveMinutes,
  onSaved,
  onDirtyChange,
  prepare,
  reloadOnFocus = true,
}: {
  project: string;
  item: DocumentItem;
  doc: Document;
  // 打開時所在的冊／設定集（後端回的故事 parent_id 是內部 id，所以由工作台樹提供 public_id）
  groupId: string;
  // null＝關閉自動存檔
  autoSaveMinutes: number | null;
  // 存檔成功後通知外層（標題可能改了，側邊列要重抓）
  onSaved: () => void;
  // 有沒有未存檔內容，外層據此在換文件、離開專案前先問
  onDirtyChange: (dirty: boolean) => void;
  // 存檔前把草稿內容轉成要送出的 content，saved 是存完後的草稿內容（當作新的已存檔基準）；丟錯就中止並顯示訊息
  prepare?: (draft: Draft) => Promise<{ content: string; saved: string }>;
  reloadOnFocus?: boolean;
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const [draft, setDraftState] = useState(() => draftOf(doc, groupId));
  const [saved, setSaved] = useState(() => draftOf(doc, groupId));
  const [updatedAt, setUpdatedAt] = useState(doc.updated_at);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  const versionRef = useRef(doc.latest_version_id);
  const savingRef = useRef(false);
  // 編輯器載入內容後會先吐一次正規化過的 markdown（補段落 marker 等），那一次不算作者的修改，
  // 要當成「已存檔」的基準，不然每篇一打開就是未存檔。外部換內容（重新載入）時也一樣，
  // 而 Tiptap v3 的 setContent 預設會觸發 onUpdate，所以換內容後一定會收到這一次。
  const baselinePendingRef = useRef(true);
  const dirty = !sameDraft(draft, saved);

  const setDraft = (patch: Partial<Draft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraftState(draftRef.current);
  };
  const markSaved = (next: Draft) => {
    savedRef.current = next;
    setSaved(next);
  };
  const setContent = (content: string) => {
    setDraft({ content });
    if (!baselinePendingRef.current) return;
    baselinePendingRef.current = false;
    markSaved({ ...savedRef.current, content });
  };

  const save = async (trigger: "manual" | "auto") => {
    const current = draftRef.current;
    if (savingRef.current || (trigger === "auto" && sameDraft(current, savedRef.current))) return;
    if (current.title.trim() === "") {
      if (trigger === "manual") showError(t("workspace.editor.titleRequired"));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const prepared = prepare ? await prepare(current) : { content: current.content, saved: current.content };
      const result = await backend.SaveDocument(project, item.kind, item.public_id, {
        title: current.title,
        summary: current.summary,
        content: prepared.content,
        trigger,
        base_version_id: versionRef.current,
      });
      versionRef.current = result.latest_version_id ?? versionRef.current;
      markSaved({ ...current, content: prepared.saved });
      setUpdatedAt(result.updated_at);
      if (result.version_conflict) setConflict(true);
      showSuccess(t(trigger === "auto" ? "workspace.editor.autoSaved" : "workspace.editor.saved"));
      onSaved();
    } catch (err) {
      // 失敗時畫面上的內容與未存檔狀態都保留，自動存檔下一輪會再試
      if (isNotLoggedIn(err)) onSessionExpired();
      else showError(`${t(trigger === "auto" ? "workspace.editor.autoSaveFailed" : "workspace.editor.saveFailed")}${errorMessage(err)}`);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  // 狀態、冊／設定集、署名一變更就 PATCH 即時存（不寫版本、不進編輯歷史，網站與 Writer 同一套規則）：
  // 先換上新值，成功就併入已存檔基準並讓側邊列重抓；失敗就還原並提示。
  const changeAttributes = async (patch: Partial<Pick<Draft, "status" | "groupId" | "profileIds">>) => {
    const previous = draftRef.current;
    setDraft(patch);
    try {
      await backend.PatchDocument(project, item.kind, item.public_id, { status: patch.status, group_id: patch.groupId, profile_ids: patch.profileIds });
      markSaved({ ...savedRef.current, ...patch });
      onSaved();
    } catch (err) {
      setDraft({ status: previous.status, groupId: previous.groupId, profileIds: previous.profileIds });
      if (isNotLoggedIn(err)) onSessionExpired();
      else showError(`${t("workspace.editor.attributeFailed")}${errorMessage(err)}`);
    }
  };

  // timer 與焦點事件只註冊一次，透過 ref 呼叫最新的 save
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!autoSaveMinutes) return;
    const timer = window.setInterval(() => void saveRef.current("auto"), autoSaveMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoSaveMinutes]);

  useEffect(() => {
    if (!reloadOnFocus) return;
    const onFocus = async () => {
      if (savingRef.current || !sameDraft(draftRef.current, savedRef.current)) return;
      // 取不到就算了，不打擾寫作；下次取得焦點再看
      const latest = await backend.Document(project, item.kind, item.public_id).catch(() => null);
      // 等回應的期間作者可能已經開始打字，這時不能蓋掉
      if (!latest || latest.latest_version_id === versionRef.current || !sameDraft(draftRef.current, savedRef.current)) return;
      versionRef.current = latest.latest_version_id;
      // 內文一樣時編輯器不會重設內容、也不會再吐一次，這時不能等基準
      baselinePendingRef.current = latest.latest_content !== draftRef.current.content;
      // 冊／設定集沿用目前的（側邊列重抓後才會知道別處有沒有搬動）
      draftRef.current = draftOf(latest, savedRef.current.groupId);
      setDraftState(draftRef.current);
      markSaved(draftRef.current);
      setUpdatedAt(latest.updated_at);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [project, item.kind, item.public_id, reloadOnFocus]);

  // 側邊列「移動到冊／設定集」搬了正在編輯的這篇：編輯頁沒改過分組就跟著換，改過就以作者的選擇為準
  useEffect(() => {
    if (draftRef.current.groupId !== savedRef.current.groupId || savedRef.current.groupId === groupId) return;
    setDraft({ groupId });
    markSaved({ ...savedRef.current, groupId });
  }, [groupId]);

  // 有未存檔內容時讓外層（換文件／離開專案）與 Go 端（關閉視窗）先問；離開這篇時清掉
  useEffect(() => {
    onDirtyChange(dirty);
    void backend.SetUnsaved(dirty);
  }, [dirty]);
  useEffect(
    () => () => {
      onDirtyChange(false);
      void backend.SetUnsaved(false);
    },
    [],
  );
  // ⌘S／Ctrl+S 手動存檔，跟網站一樣
  usePrimaryShortcut("s", () => void saveRef.current("manual"));

  return { draft, setDraft, setContent, changeAttributes, dirty, saving, updatedAt, conflict, dismissConflict: () => setConflict(false), save: () => saveRef.current("manual") };
}

export type DocumentDraftState = ReturnType<typeof useDocumentDraft>;
