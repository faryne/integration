import CloseIcon from "@mui/icons-material/Close";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import { StorytellerWysiwygMarkdown } from "@/pages/storyteller/StorytellerWysiwygMarkdown.tsx";
import { StorytellerLoreLinkContext } from "@/pages/storyteller/storytellerLoreLinkContext.ts";
import { useWorkspaceOpenDocument } from "@/pages/storyteller/WorkspaceOpenDocumentContext.ts";
import type { CommentRef } from "@/pages/storyteller/wysiwygCore/commentRefs.ts";
import { CommentRefChip } from "./CommentRefChip.tsx";
import { commentRefKey, useCommentRefTargets } from "./useCommentRefTargets.ts";

export type CommentRefCardState = { refs: CommentRef[]; active: number };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
  });

// 參照卡：釘在畫面右上、不搶游標，邊寫邊看註解夾的故事／設定（或點到的設定連結）。
// 內容是「已存檔版本」（清單上的 latest_content），跟 AI 助理一樣不讀別篇編輯中的草稿。
// 標題列可拖曳；同一則註解夾了多篇時在上方切換；卡片內容裡的設定連結點了就切到那則設定。
// 呼叫端每次開啟換 key，卡片重新初始化（拖曳位置也回到預設）。
export function CommentRefCard({
  projectPublicId,
  initial,
  onClose,
}: {
  projectPublicId?: string;
  initial: CommentRefCardState;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState(initial);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const { targets, loaded } = useCommentRefTargets(projectPublicId);
  const openDocument = useWorkspaceOpenDocument();
  const ref = state.refs[state.active];
  const target = targets.get(commentRefKey(ref));
  const show = (next: CommentRef) =>
    setState((current) => {
      const index = current.refs.findIndex(
        (item) => commentRefKey(item) === commentRefKey(next),
      );
      return index >= 0
        ? { ...current, active: index }
        : { refs: [...current.refs, next], active: current.refs.length };
    });

  // 拖曳：記住按下時滑鼠跟目前位移的差，移動時換算新位移
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragRef.current)
      setOffset({
        x: event.clientX - dragRef.current.x,
        y: event.clientY - dragRef.current.y,
      });
  };

  return createPortal(
    <Paper
      elevation={12}
      sx={{
        position: "fixed",
        top: 96,
        right: 24,
        zIndex: 1250,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 160px)",
        display: "flex",
        flexDirection: "column",
        transform: `translate(${offset.x}px, ${offset.y}px)`,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (dragRef.current = null)}
        sx={{
          px: 1.5,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          cursor: "move",
          userSelect: "none",
        }}
      >
        <PushPinOutlinedIcon fontSize="small" color="action" />
        <Typography variant="subtitle2" noWrap sx={{ flex: 1 }}>
          {target?.title ?? (loaded ? t("web.commentRef.deleted") : "")}
        </Typography>
        <IconButton
          size="small"
          aria-label={t("web.common.close")}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      {state.refs.length > 1 && (
        <Stack
          direction="row"
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          sx={{ px: 1.5, pt: 1 }}
        >
          {state.refs.map((item, index) => (
            <CommentRefChip
              key={commentRefKey(item)}
              refItem={item}
              target={targets.get(commentRefKey(item))}
              loaded={loaded}
              color={index === state.active ? "primary" : "default"}
              onClick={() =>
                setState((current) => ({ ...current, active: index }))
              }
            />
          ))}
        </Stack>
      )}
      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: 2, py: 1.5 }}>
        {target && (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 1 }}
            >
              {t("web.commentRef.savedVersion", {
                kind:
                  target.kind === "lore"
                    ? t("web.commentRef.lore")
                    : t("web.commentRef.story"),
              })}
              {formatTime(target.updatedAt)}
            </Typography>
            {target.isImage ? (
              <Typography variant="body2" color="text.secondary">
                {t("web.commentRef.imageNoText")}
              </Typography>
            ) : (
              <StorytellerLoreLinkContext.Provider
                value={(loreId, children) => (
                  <Box
                    component="span"
                    role="link"
                    onClick={() => show({ kind: "lore", publicId: loreId })}
                    sx={{
                      color: "secondary.main",
                      textDecoration: "underline dotted",
                      cursor: "pointer",
                    }}
                  >
                    {children}
                  </Box>
                )}
              >
                <Box sx={{ fontSize: 14, lineHeight: 1.8 }}>
                  <StorytellerWysiwygMarkdown>
                    {target.content}
                  </StorytellerWysiwygMarkdown>
                </Box>
              </StorytellerLoreLinkContext.Provider>
            )}
          </>
        )}
      </Box>
      {openDocument && target && (
        <Stack
          direction="row"
          justifyContent="flex-end"
          sx={{ px: 1.5, py: 1, borderTop: 1, borderColor: "divider" }}
        >
          <Button
            size="small"
            onClick={() =>
              openDocument({
                kind: target.kind,
                publicId: target.publicId,
                isImage: target.isImage,
              })
            }
          >
            {t("web.commentRef.openEditor")}
          </Button>
        </Stack>
      )}
    </Paper>,
    document.body,
  );
}
