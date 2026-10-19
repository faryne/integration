import type { AlertColor } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  useCreateStorytellerWritingBookmark,
  useDeleteStorytellerWritingBookmark,
  useStorytellerWritingBookmarks,
  useUpdateStorytellerWritingBookmark,
  type WritingBookmarkTarget,
} from "@/apis/storyteller.ts";

function errorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response
  ) {
    const data = error.response.data as { message?: string };
    return data.message || fallback;
  }
  return fallback;
}

interface UseStorytellerEditorOutlineArgs {
  projectPublicId?: string;
  storyPublicId?: string;
  lorePublicId?: string;
  onSnack: (message: string, severity?: AlertColor) => void;
}

// StoryEditor／LoreEditor 共用的大綱面板＋書籤 CRUD 狀態，兩邊行為保持一致。
export function useStorytellerEditorOutline({
  projectPublicId,
  storyPublicId,
  lorePublicId,
  onSnack,
}: UseStorytellerEditorOutlineArgs) {
  const { t } = useTranslation();
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  const target: WritingBookmarkTarget | undefined = storyPublicId
    ? { kind: "story", storyPublicId }
    : lorePublicId
      ? { kind: "lore", lorePublicId }
      : undefined;

  const bookmarksQuery = useStorytellerWritingBookmarks(
    projectPublicId,
    target,
  );
  const createBookmark = useCreateStorytellerWritingBookmark(
    projectPublicId,
    target,
  );
  const updateBookmark = useUpdateStorytellerWritingBookmark(
    projectPublicId,
    target,
  );
  const deleteBookmark = useDeleteStorytellerWritingBookmark(
    projectPublicId,
    target,
  );

  const bookmarks = bookmarksQuery.data ?? [];
  const bookmarkedMarkerIds = useMemo(
    () => new Set(bookmarks.map((row) => row.marker_id)),
    [bookmarks],
  );
  // 給編輯器「點擊既有書籤直接編輯筆記」用：開編輯 dialog 當下要能預先帶入
  // 目前的筆記內容，不用另外重新打一次 API。
  const bookmarkNotesByMarkerId = useMemo(
    () => new Map(bookmarks.map((row) => [row.marker_id, row.note ?? ""])),
    [bookmarks],
  );

  const handleEditorReady = useCallback((next: Editor | null) => {
    setEditor(next);
  }, []);

  const addBookmark = useCallback(
    (markerId: string, note: string) => {
      createBookmark.mutate(
        { marker_id: markerId, note },
        {
          onSuccess: () => onSnack(t("writer:editor.bookmarks.added")),
          onError: (error) =>
            onSnack(
              errorMessage(error, t("writer:editor.bookmarks.addFailed")),
              "error",
            ),
        },
      );
    },
    [createBookmark, onSnack, t],
  );

  const saveBookmarkNote = useCallback(
    (markerId: string, note: string) => {
      updateBookmark.mutate(
        { marker_id: markerId, note },
        {
          onSuccess: () => onSnack(t("writer:editor.bookmarks.noteUpdated")),
          onError: (error) =>
            onSnack(
              errorMessage(error, t("writer:editor.bookmarks.updateFailed")),
              "error",
            ),
        },
      );
    },
    [onSnack, t, updateBookmark],
  );

  const removeBookmark = useCallback(
    (markerId: string) => {
      deleteBookmark.mutate(markerId, {
        onSuccess: () => onSnack(t("writer:editor.bookmarks.removed")),
        onError: (error) =>
          onSnack(
            errorMessage(error, t("writer:editor.bookmarks.removeFailed")),
            "error",
          ),
      });
    },
    [deleteBookmark, onSnack, t],
  );

  return {
    outlineOpen,
    setOutlineOpen,
    editor,
    onEditorReady: handleEditorReady,
    bookmarks,
    bookmarksLoading: bookmarksQuery.isLoading,
    bookmarkedMarkerIds,
    bookmarkNotesByMarkerId,
    canBookmark: Boolean(projectPublicId && target),
    addBookmark,
    saveBookmarkNote,
    removeBookmark,
  };
}
