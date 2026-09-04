import type { AlertColor } from "@mui/material";
import type { Editor } from "@tiptap/core";
import { useCallback, useMemo, useState } from "react";

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

  const handleEditorReady = useCallback((next: Editor | null) => {
    setEditor(next);
  }, []);

  const addBookmark = useCallback(
    (markerId: string, note: string) => {
      createBookmark.mutate(
        { marker_id: markerId, note },
        {
          onSuccess: () => onSnack("已加入書籤。"),
          onError: (error) =>
            onSnack(errorMessage(error, "加入書籤失敗。"), "error"),
        },
      );
    },
    [createBookmark, onSnack],
  );

  const saveBookmarkNote = useCallback(
    (markerId: string, note: string) => {
      updateBookmark.mutate(
        { marker_id: markerId, note },
        {
          onSuccess: () => onSnack("已更新書籤筆記。"),
          onError: (error) =>
            onSnack(errorMessage(error, "更新書籤失敗。"), "error"),
        },
      );
    },
    [onSnack, updateBookmark],
  );

  const removeBookmark = useCallback(
    (markerId: string) => {
      deleteBookmark.mutate(markerId, {
        onSuccess: () => onSnack("已移除書籤。"),
        onError: (error) =>
          onSnack(errorMessage(error, "移除書籤失敗。"), "error"),
      });
    },
    [deleteBookmark, onSnack],
  );

  return {
    outlineOpen,
    setOutlineOpen,
    editor,
    onEditorReady: handleEditorReady,
    bookmarks,
    bookmarksLoading: bookmarksQuery.isLoading,
    bookmarkedMarkerIds,
    canBookmark: Boolean(projectPublicId && target),
    addBookmark,
    saveBookmarkNote,
    removeBookmark,
  };
}
