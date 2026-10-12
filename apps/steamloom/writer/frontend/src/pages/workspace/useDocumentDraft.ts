import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSnack } from "@writer/components/SnackProvider.tsx";
import { backend, errorMessage, isNotLoggedIn, type Document, type DocumentItem } from "@writer/lib/backend.ts";
import { SessionExpiredContext } from "@writer/lib/useBackendData.ts";

export type Draft = { title: string; summary: string; content: string };

const draftOf = (doc: Document): Draft => ({ title: doc.title, summary: doc.summary ?? "", content: doc.latest_content ?? "" });
const sameDraft = (a: Draft, b: Draft) => a.title === b.title && a.summary === b.summary && a.content === b.content;

// 編輯分頁的草稿與存檔，行為比照網站 StoryEditor／LoreEditor（雙胞胎，故事與設定共用這一份）：
// - 手動存檔每次都送（跟網站一樣會多一個版本）；自動存檔只在內容有變、標題不是空白時送。
// - 都帶 base_version_id，後端照樣寫入，但回 version_conflict 時顯示提示，請作者去編輯歷史確認。
// - 視窗重新取得焦點時，沒有未存檔內容就看伺服器上有沒有新版本（網站或 AI 助理改過），有就直接換上。
// timer／focus 事件裡讀到的都要是最新值，所以草稿、版本另外放 ref。
export function useDocumentDraft({
  project,
  item,
  doc,
  autoSaveMinutes,
  onSaved,
}: {
  project: string;
  item: DocumentItem;
  doc: Document;
  // null＝關閉自動存檔
  autoSaveMinutes: number | null;
  // 存檔成功後通知外層（標題可能改了，側邊列要重抓）
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnack();
  const onSessionExpired = useContext(SessionExpiredContext);
  const [draft, setDraftState] = useState(() => draftOf(doc));
  const [saved, setSaved] = useState(() => draftOf(doc));
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
      const result = await backend.SaveDocument(project, item.kind, item.public_id, {
        title: current.title,
        summary: current.summary,
        content: current.content,
        trigger,
        base_version_id: versionRef.current,
      });
      versionRef.current = result.latest_version_id ?? versionRef.current;
      markSaved(current);
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
  // timer 與焦點事件只註冊一次，透過 ref 呼叫最新的 save
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!autoSaveMinutes) return;
    const timer = window.setInterval(() => void saveRef.current("auto"), autoSaveMinutes * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [autoSaveMinutes]);

  useEffect(() => {
    const onFocus = async () => {
      if (savingRef.current || !sameDraft(draftRef.current, savedRef.current)) return;
      // 取不到就算了，不打擾寫作；下次取得焦點再看
      const latest = await backend.Document(project, item.kind, item.public_id).catch(() => null);
      // 等回應的期間作者可能已經開始打字，這時不能蓋掉
      if (!latest || latest.latest_version_id === versionRef.current || !sameDraft(draftRef.current, savedRef.current)) return;
      versionRef.current = latest.latest_version_id;
      // 內文一樣時編輯器不會重設內容、也不會再吐一次，這時不能等基準
      baselinePendingRef.current = latest.latest_content !== draftRef.current.content;
      draftRef.current = draftOf(latest);
      setDraftState(draftRef.current);
      markSaved(draftRef.current);
      setUpdatedAt(latest.updated_at);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [project, item.kind, item.public_id]);

  // 有未存檔內容時讓 Go 端在關閉視窗前先問；離開這篇（換文件、離開專案）時清掉
  useEffect(() => {
    void backend.SetUnsaved(dirty);
  }, [dirty]);
  useEffect(() => () => void backend.SetUnsaved(false), []);

  return { draft, setDraft, setContent, dirty, saving, updatedAt, conflict, dismissConflict: () => setConflict(false), save: () => saveRef.current("manual") };
}
