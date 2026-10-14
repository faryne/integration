import { usePrimaryShortcut } from "@/helpers/shortcut.ts";
import { contentWordCount } from "@/pages/storyteller/storytellerContentWordCount.ts";
import { useEffect, useRef, useState } from "react";

// 故事與設定共用的草稿／存檔邏輯，網站（StoryEditor／LoreEditor）與 SteamLoom Writer 都用這一份
// （Writer 透過 alias 直接 import，改這支也會影響 Writer）。存檔怎麼送交給 adapter：
// 網站與 Writer 的文字文件用 webDocumentAdapter（Writer 經 Go 的 ApiProxy 轉發），Writer 的圖像作品用 Go 綁定。
//
// 規則：
// - 手動存檔每次都送；自動存檔只在內容有變、標題不是空白時送。新文件（還沒有 publicId）不自動存檔。
// - 都帶 base_version_id，後端照樣寫入，但回 version_conflict 時顯示提示，請作者去編輯歷史確認。
// - 狀態、冊／設定集、署名一變更就 PATCH 即時存（不寫版本、不進編輯歷史）；新文件先留在草稿，第一次存檔一起送。
// - 伺服器上的文件換了（重新載入、別處改過），沒有未存檔內容才換上；有的話保留作者的草稿，下次存檔會被標成衝突。
// - 標題跟內容都空白時不算「值得保護的未存檔變更」，離開前不用確認。

export type DocumentKind = "story" | "lore";
export type PublicationStatus = "draft" | "completed";
export type DocumentSaveTrigger = "manual" | "auto" | "agent_apply";

// groupId 是所在冊（故事）或設定集（設定）的 public_id，空字串＝未分冊／未歸類；profileIds 只有故事用（0＝本人）。
// isSpoiler／dependsOn 只有設定用，依賴以 "story:<id>"／"lore:<id>" 記錄，順序就是作者勾選的順序。
export interface DocumentDraft {
  title: string;
  summary: string;
  content: string;
  status: PublicationStatus;
  groupId: string;
  profileIds: number[];
  isSpoiler: boolean;
  dependsOn: string[];
}

// 各平台自己載入文件後轉成這個形狀交給 hook；publicId 沒有＝還沒建立的新文件
export interface EditingDocument extends DocumentDraft {
  publicId?: string;
  versionId: number | null;
  updatedAt?: string;
  sort: number;
  // 最新版本本身就帶著衝突標記（作者錯過當下的提示，回來仍看得到）
  conflicted?: boolean;
}

export type DocumentAttributePatch = Partial<
  Pick<DocumentDraft, "status" | "groupId" | "profileIds">
>;

export interface DocumentSaveResult {
  publicId?: string;
  versionId: number | null;
  updatedAt?: string;
  conflict: boolean;
  // 後端實際存下的內文（可能補了段落 marker）；有帶就用它同步編輯區
  content?: string;
}

export interface DocumentEditingAdapter {
  save: (
    draft: DocumentDraft,
    options: {
      trigger: DocumentSaveTrigger;
      publicId?: string;
      baseVersionId: number | null;
      sort: number;
    },
  ) => Promise<DocumentSaveResult>;
  patch: (publicId: string, patch: DocumentAttributePatch) => Promise<void>;
  // 存檔前把草稿內容轉成要送出的 content，saved 是存完後的草稿內容（圖像作品先上傳本機圖）；丟錯就中止
  prepare?: (
    draft: DocumentDraft,
  ) => Promise<{ content: string; saved: string }>;
}

export interface DocumentEditingMessages {
  saved: string;
  autoSaved: string;
  agentApplied: string;
  saveFailed: string;
  autoSaveFailed: string;
  titleRequired: string;
  attributeFailed: string;
}

export const defaultDocumentEditingMessages = (
  kind: DocumentKind,
): DocumentEditingMessages => {
  const name = kind === "story" ? "故事" : "設定";
  return {
    saved: `${name}已存檔。`,
    autoSaved: "已自動存檔。",
    agentApplied: "已套用 AI 提案並存檔。",
    saveFailed: `${name}存檔失敗，請重試。`,
    autoSaveFailed: `${name}自動存檔失敗，請手動重試。`,
    titleRequired: "請先輸入標題。",
    attributeFailed: "屬性更新失敗，請重試。",
  };
};

export type DocumentNotify = (
  message: string,
  severity?: "success" | "info" | "warning" | "error",
) => void;

const sameList = <T>(a: T[], b: T[]) => a.join() === b.join();
const sameDraft = (a: DocumentDraft, b: DocumentDraft) =>
  a.title === b.title &&
  a.summary === b.summary &&
  a.content === b.content &&
  a.status === b.status &&
  a.groupId === b.groupId &&
  sameList(a.profileIds, b.profileIds) &&
  a.isSpoiler === b.isSpoiler &&
  sameList(a.dependsOn, b.dependsOn);

const draftOf = (doc: EditingDocument): DocumentDraft => ({
  title: doc.title,
  summary: doc.summary,
  content: doc.content,
  status: doc.status,
  groupId: doc.groupId,
  profileIds: doc.profileIds,
  isSpoiler: doc.isSpoiler,
  dependsOn: doc.dependsOn,
});

export function useDocumentEditing({
  doc,
  adapter,
  autoSaveMinutes,
  messages,
  notify,
  notifyError,
  onSaved,
  onCreated,
}: {
  doc: EditingDocument;
  adapter: DocumentEditingAdapter;
  // null＝關閉自動存檔
  autoSaveMinutes: number | null;
  messages: DocumentEditingMessages;
  notify: DocumentNotify;
  // 錯誤怎麼呈現交給平台（Writer 遇到授權失效要回登入頁、不顯示訊息）
  notifyError: (fallback: string, error: unknown) => void;
  // 存檔或屬性更新成功（標題、冊可能改了，側邊列要重抓）
  onSaved?: (result: DocumentSaveResult | null) => void;
  // 新文件第一次存檔成功，拿到 publicId
  onCreated?: (publicId: string) => void;
}) {
  const [draft, setDraftState] = useState(() => draftOf(doc));
  const [saved, setSavedState] = useState(() => draftOf(doc));
  const [updatedAt, setUpdatedAt] = useState(doc.updatedAt);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(Boolean(doc.conflicted));
  // timer、事件、存檔回呼裡讀到的都要是最新值，所以草稿、版本另外放 ref
  const draftRef = useRef(draft);
  const savedRef = useRef(saved);
  const versionRef = useRef(doc.versionId);
  const publicIdRef = useRef(doc.publicId);
  const savingRef = useRef(false);
  // 編輯器載入內容後會先吐一次正規化過的 markdown（補段落 marker 等），那一次不算作者的修改，
  // 要當成「已存檔」的基準，不然每篇一打開就是未存檔。外部換內容時也一樣（Tiptap 的 setContent 會觸發 onUpdate）。
  const baselinePendingRef = useRef(true);
  // 上面的基準只解決誤報未存檔，不代表補出來的 marker 真的存進後端過；書籤依賴 marker 已落地，
  // 加書籤前要看這個旗標決定要不要先存一次（不影響離開前確認）
  const unpersistedMarkersRef = useRef(false);
  const dirty = !sameDraft(draft, saved);

  const setDraft = (patch: Partial<DocumentDraft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraftState(draftRef.current);
  };
  const markSaved = (next: DocumentDraft) => {
    savedRef.current = next;
    setSavedState(next);
  };
  const setContent = (content: string) => {
    setDraft({ content });
    if (!baselinePendingRef.current) return;
    baselinePendingRef.current = false;
    unpersistedMarkersRef.current = content !== savedRef.current.content;
    markSaved({ ...savedRef.current, content });
  };
  // 整份換成伺服器上的內容（重新載入、回復版本）；force 時連未存檔內容一起蓋掉
  const replaceWith = (next: EditingDocument) => {
    versionRef.current = next.versionId;
    if (next.publicId) publicIdRef.current = next.publicId;
    // 內文一樣時編輯器不會重設內容、也不會再吐一次，這時不能等基準
    baselinePendingRef.current = next.content !== draftRef.current.content;
    draftRef.current = draftOf(next);
    setDraftState(draftRef.current);
    markSaved(draftRef.current);
    setUpdatedAt(next.updatedAt);
  };

  // 回傳存檔結果（失敗、沒真的送出時是 null），讓「先存檔再套用 AI 提案」可以等存完。
  // patch 是存檔前一併套用到草稿的欄位（套用 AI 提案時用）
  const save = async (
    trigger: DocumentSaveTrigger,
    patch?: Partial<DocumentDraft>,
  ): Promise<DocumentSaveResult | null> => {
    if (patch) setDraft(patch);
    const current = draftRef.current;
    if (
      savingRef.current ||
      (trigger === "auto" && sameDraft(current, savedRef.current))
    )
      return null;
    if (current.title.trim() === "") {
      if (trigger !== "auto") notify(messages.titleRequired, "error");
      return null;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const prepared = adapter.prepare
        ? await adapter.prepare(current)
        : { content: current.content, saved: current.content };
      const result = await adapter.save(
        { ...current, content: prepared.content },
        {
          trigger,
          publicId: publicIdRef.current,
          baseVersionId: publicIdRef.current ? versionRef.current : null,
          sort: doc.sort,
        },
      );
      versionRef.current = result.versionId ?? versionRef.current;
      const savedContent = result.content ?? prepared.saved;
      // 後端補了 marker 等於存下的內文跟送出的不同：草稿跟著換，編輯區顯示的 marker 才跟資料庫一致
      if (savedContent !== prepared.saved && draftRef.current === current) {
        baselinePendingRef.current = true;
        setDraft({ content: savedContent });
      }
      markSaved({ ...current, content: savedContent });
      unpersistedMarkersRef.current = false;
      setUpdatedAt(result.updatedAt);
      if (result.conflict) setConflict(true);
      notify(
        trigger === "auto"
          ? messages.autoSaved
          : trigger === "agent_apply"
            ? messages.agentApplied
            : messages.saved,
      );
      if (!publicIdRef.current && result.publicId) {
        publicIdRef.current = result.publicId;
        onCreated?.(result.publicId);
      }
      onSaved?.(result);
      return result;
    } catch (error) {
      // 失敗時畫面上的內容與未存檔狀態都保留，自動存檔下一輪會再試
      notifyError(
        trigger === "auto" ? messages.autoSaveFailed : messages.saveFailed,
        error,
      );
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  // 先換上新值，成功就併入已存檔基準；失敗就還原並提示。新文件沒有東西可以 PATCH，留在草稿等第一次存檔
  const changeAttributes = async (patch: DocumentAttributePatch) => {
    const previous = draftRef.current;
    setDraft(patch);
    const publicId = publicIdRef.current;
    if (!publicId) return;
    try {
      await adapter.patch(publicId, patch);
      markSaved({ ...savedRef.current, ...patch });
      onSaved?.(null);
    } catch (error) {
      setDraft({
        status: previous.status,
        groupId: previous.groupId,
        profileIds: previous.profileIds,
      });
      notifyError(messages.attributeFailed, error);
    }
  };

  // timer 與快捷鍵只註冊一次，透過 ref 呼叫最新的 save
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    if (!autoSaveMinutes || !doc.publicId) return;
    const timer = window.setInterval(
      () => void saveRef.current("auto"),
      autoSaveMinutes * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [autoSaveMinutes, doc.publicId]);
  // ⌘S／Ctrl+S 手動存檔
  usePrimaryShortcut("s", () => void saveRef.current("manual"));

  // 伺服器上的內容換了（重新載入、別處改過）：沒有未存檔內容才換上；版本一樣代表是自己剛存的那份
  useEffect(() => {
    if (doc.versionId === versionRef.current) return;
    if (!sameDraft(draftRef.current, savedRef.current)) return;
    replaceWith(doc);
    // 只看內容類欄位，屬性在下一個 effect 處理
  }, [doc.versionId, doc.title, doc.summary, doc.content]);

  // 屬性（狀態、冊／設定集、署名）是即時 PATCH 的，伺服器值變了（側邊列搬移、⋮ 改狀態）直接跟著換
  useEffect(() => {
    const attributes = {
      status: doc.status,
      groupId: doc.groupId,
      profileIds: doc.profileIds,
    };
    const current = savedRef.current;
    if (
      current.status === attributes.status &&
      current.groupId === attributes.groupId &&
      sameList(current.profileIds, attributes.profileIds)
    )
      return;
    setDraft(attributes);
    markSaved({ ...current, ...attributes });
  }, [doc.status, doc.groupId, doc.profileIds.join()]);

  // 值得保護的未存檔變更：跟已存檔不同，且標題、內容不是都空白（離開前確認、關閉視窗前確認共用）
  const hasUnsavedChanges = () => {
    const current = draftRef.current;
    return (
      !sameDraft(current, savedRef.current) &&
      !(current.title.trim() === "" && contentWordCount(current.content) === 0)
    );
  };

  return {
    draft,
    setDraft,
    setContent,
    changeAttributes,
    dirty,
    saving,
    updatedAt,
    conflict,
    dismissConflict: () => setConflict(false),
    showConflict: () => setConflict(true),
    hasUnsavedChanges,
    hasUnpersistedMarkers: () => unpersistedMarkersRef.current,
    save: (
      trigger: DocumentSaveTrigger = "manual",
      patch?: Partial<DocumentDraft>,
    ) => saveRef.current(trigger, patch),
    replaceWith,
    publicId: () => publicIdRef.current,
  };
}

export type DocumentEditingState = ReturnType<typeof useDocumentEditing>;
