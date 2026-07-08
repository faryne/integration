import AddCommentIcon from "@mui/icons-material/AddComment";
import DeleteIcon from "@mui/icons-material/Delete";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { CommentHighlight } from "./wysiwygCore/commentHighlight";
import { markdownToDoc } from "./wysiwygCore/parser";
import { serializeDocToMarkdown } from "./wysiwygCore/serializer";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import {
  ALIGNMENT_VALUES,
  COMMENT_COLOR_VALUES,
  DEFAULT_COMMENT_COLOR,
  DEFAULT_HEADING_LEVEL,
  HEADING_LEVELS,
  type AlignmentValue,
  type CommentColorValue,
  type HeadingLevel,
} from "./wysiwygCore/whitelist";
import { wysiwygCoreExtensions } from "./wysiwygCore/extensions";

interface HoveredComment {
  text: string;
  /** hover 當下該段落的 bounding rect（viewport 座標），用來把 tooltip 定位在段落正下方。 */
  rect: DOMRect;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

/** 註解底色的實際色值跟顯示名稱，固定色盤（見 whitelist.ts 的 COMMENT_COLOR_VALUES）。 */
const COMMENT_COLOR_STYLES: Record<
  CommentColorValue,
  { background: string; border: string }
> = {
  yellow: { background: "rgba(255, 214, 0, 0.16)", border: "#ffd600" },
  pink: { background: "rgba(236, 64, 122, 0.14)", border: "#ec407a" },
  blue: { background: "rgba(66, 165, 245, 0.16)", border: "#42a5f5" },
  green: { background: "rgba(102, 187, 106, 0.16)", border: "#66bb6a" },
  purple: { background: "rgba(171, 71, 188, 0.16)", border: "#ab47bc" },
};

const COMMENT_COLOR_LABELS: Record<CommentColorValue, string> = {
  yellow: "黃",
  pink: "粉紅",
  blue: "藍",
  green: "綠",
  purple: "紫",
};

// 只在編輯區生效的高亮樣式，刻意不放進 typographySx.ts 共用——
// 註解本來就不該出現在預覽區（故事閱讀頁），兩邊的樣式不應該混在一起。
// 每種顏色各自一個 class（見 commentHighlight.ts 怎麼決定套用哪個 class），
// 而不是用 inline style，這樣才能繼續透過 sx 主題化、深色模式等既有機制。
const COMMENT_HIGHLIGHT_SX = {
  ...Object.fromEntries(
    COMMENT_COLOR_VALUES.map((color) => [
      `& .wysiwyg-comment-color-${color}`,
      {
        backgroundColor: COMMENT_COLOR_STYLES[color].background,
        borderLeft: `3px solid ${COMMENT_COLOR_STYLES[color].border}`,
        paddingLeft: "8px",
        marginLeft: "-8px",
        borderRadius: "2px",
      },
    ]),
  ),
  // 用游標樣式提示「這裡可以右鍵開編輯工具」，不用另外疊一個 tooltip——
  // 有註解的段落 hover 時已經會跳出註解內容的 tooltip 了，再加一個提示視窗只會更亂。
  "& p, & h1, & h2, & h3, & h4, & h5, & h6": {
    cursor: "context-menu",
  },
} as const;

const HEADING_LEVEL_OPTIONS: { value: HeadingLevel; label: string }[] = [
  { value: 0, label: "內文" },
  ...HEADING_LEVELS.map((level) => ({ value: level, label: `標題 ${level}` })),
];

export interface StorytellerWysiwygEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  /** 塞在工具列最右側的額外操作（例如 AI Agent／編輯歷史切換按鈕），不提供就不顯示。 */
  toolbarExtra?: ReactNode;
}

/**
 * 故事/設定集內容的所見即所得編輯器，對外是單純的 { value, onChange } 字串介面
 * （跟原本的 TextField 相容），內部負責 markdown 字串跟 Tiptap doc 的雙向轉換。
 *
 * value 變更但不是這個元件自己 onChange 出去的（例如 AI agent 把結果附加進 content），
 * 需要重新 setContent 讓編輯器同步；反過來，這個元件自己 onUpdate 觸發的 onChange
 * 不能再讓下面的 effect 重新 setContent 一次，不然每打一個字游標就會被重置。
 * lastEmittedRef 就是用來分辨這兩種情況。
 */
export function StorytellerWysiwygEditor({
  value,
  onChange,
  toolbarExtra,
}: StorytellerWysiwygEditorProps) {
  const lastEmittedRef = useRef(value);

  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [pendingMarkerId, setPendingMarkerId] = useState<string | null>(null);
  const [pendingSnippet, setPendingSnippet] = useState("");
  const [pendingHadExistingComment, setPendingHadExistingComment] =
    useState(false);
  const [pendingCommentColor, setPendingCommentColor] =
    useState<CommentColorValue>(DEFAULT_COMMENT_COLOR);
  const [hoveredComment, setHoveredComment] = useState<HoveredComment | null>(
    null,
  );
  const [contextMenuPosition, setContextMenuPosition] =
    useState<ContextMenuPosition | null>(null);

  const editor = useEditor({
    extensions: [...wysiwygCoreExtensions, CommentHighlight],
    content: markdownToDoc(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        style: "min-height: 320px; outline: none;",
      },
      // 白名單規則：不接受任何 HTML 內容。無論剪貼簿裡帶了什麼樣式，
      // 一律只取 text/plain 內容當純文字插入，貼上後格式跑掉是可接受的結果。
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text === "") return false;
        event.preventDefault();
        view.dispatch(view.state.tr.insertText(text));
        return true;
      },
    },
    onUpdate: ({ editor: updatedEditor }) => {
      const next = serializeDocToMarkdown(updatedEditor.getJSON());
      lastEmittedRef.current = next;
      onChange(next);
    },
    onCreate: ({ editor: createdEditor }) => {
      const next = serializeDocToMarkdown(createdEditor.getJSON());
      lastEmittedRef.current = next;
      onChange(next);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(markdownToDoc(value));
  }, [value, editor]);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return {
          bold: false,
          italic: false,
          underline: false,
          subscript: false,
          superscript: false,
          align: "left" as AlignmentValue,
          headingLevel: DEFAULT_HEADING_LEVEL,
          hasComment: false,
        };
      }
      const align =
        ALIGNMENT_VALUES.find((v) => ctx.editor!.isActive({ textAlign: v })) ??
        "left";
      const headingLevel =
        HEADING_LEVELS.find((level) =>
          ctx.editor!.isActive("paragraph", { headingLevel: level }),
        ) ?? DEFAULT_HEADING_LEVEL;
      return {
        bold: ctx.editor.isActive("bold"),
        italic: ctx.editor.isActive("italic"),
        underline: ctx.editor.isActive("underline"),
        subscript: ctx.editor.isActive("subscript"),
        superscript: ctx.editor.isActive("superscript"),
        align,
        headingLevel,
        hasComment: Boolean(
          ctx.editor.state.selection.$from.parent.attrs.comment,
        ),
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  const handleOpenCommentDialog = () => {
    const parent = editor.state.selection.$from.parent;
    const markerId = parent.attrs.markerId as string | null;
    if (!markerId) return;
    const existingComment = parent.attrs.comment as string | null;
    const existingColor = parent.attrs.commentColor as CommentColorValue | null;
    setPendingMarkerId(markerId);
    setPendingSnippet(parent.textContent.slice(0, 24) || "(空段落)");
    setPendingHadExistingComment(Boolean(existingComment));
    setCommentDraft(existingComment ?? "");
    setPendingCommentColor(existingColor ?? DEFAULT_COMMENT_COLOR);
    setCommentDialogOpen(true);
  };

  const handleConfirmComment = () => {
    if (!pendingMarkerId || commentDraft.trim() === "") return;
    editor
      .chain()
      .focus()
      .setComment(commentDraft.trim(), pendingCommentColor)
      .run();
    setCommentDialogOpen(false);
  };

  // 找到目前文件裡持有這個 markerId 的段落，直接用位置操作清掉它的 comment/commentColor
  // attribute——不透過 selection/focus，因為要刪除的段落不一定是目前游標所在的段落。
  const handleRemoveComment = (markerId: string) => {
    let targetPos: number | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && node.attrs.markerId === markerId) {
        targetPos = pos;
        return false;
      }
      return true;
    });
    if (targetPos === null) return;
    const confirmedPos = targetPos;
    editor.commands.command(({ tr }) => {
      tr.setNodeAttribute(confirmedPos, "comment", null);
      tr.setNodeAttribute(confirmedPos, "commentColor", null);
      return true;
    });
    setCommentDialogOpen(false);
  };

  // hover 在編輯區內任何地方時，往上找最近的 .wysiwyg-has-comment 段落（事件代理，
  // 不用替每個段落個別掛 listener）。註解文字直接讀 decoration 附加的 data-comment，
  // 定位資訊用 getBoundingClientRect()，所以 tooltip 用 position: fixed 直接對齊。
  const handleEditorMouseOver = (event: MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      ".wysiwyg-has-comment",
    );
    const comment = target?.dataset.comment;
    if (!target || !comment) return;
    setHoveredComment({ text: comment, rect: target.getBoundingClientRect() });
  };

  const handleEditorMouseOut = (event: MouseEvent<HTMLDivElement>) => {
    const stillInsideSameParagraph = (
      event.relatedTarget as HTMLElement | null
    )?.closest(".wysiwyg-has-comment");
    if (!stillInsideSameParagraph) {
      setHoveredComment(null);
    }
  };

  // 右鍵點哪裡，就把選取範圍移到那個位置（posAtCoords 換算螢幕座標成文件內位置），
  // 不管那段目前有沒有註解都適用——不像 hover 高亮，只有已經有註解的段落才有
  // .wysiwyg-has-comment 可以定位，右鍵選單要對「還沒加註解」的段落也能開。
  const handleEditorContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const result = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!result) return;
    editor.commands.setTextSelection(result.pos);
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => setContextMenuPosition(null);

  const handleContextMenuAddOrEditComment = () => {
    closeContextMenu();
    handleOpenCommentDialog();
  };

  const handleContextMenuRemoveComment = () => {
    const markerId = editor.state.selection.$from.parent.attrs.markerId as
      string | null;
    closeContextMenu();
    if (markerId) handleRemoveComment(markerId);
  };

  const activeMarks = [
    editorState.bold && "bold",
    editorState.italic && "italic",
    editorState.underline && "underline",
    editorState.subscript && "subscript",
    editorState.superscript && "superscript",
  ].filter(Boolean) as string[];

  return (
    <Box>
      <Paper variant="outlined" sx={{ p: 1, mb: 1 }}>
        <Stack
          direction="row"
          spacing={2}
          flexWrap="wrap"
          useFlexGap
          alignItems="center"
        >
          <Select
            size="small"
            value={editorState.headingLevel}
            onChange={(event: SelectChangeEvent<number>) =>
              editor
                .chain()
                .focus()
                .setHeadingLevel(Number(event.target.value) as HeadingLevel)
                .run()
            }
          >
            {HEADING_LEVEL_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup
            size="small"
            value={activeMarks}
            onChange={() => {}}
          >
            <Tooltip title="粗體">
              <ToggleButton
                value="bold"
                selected={editorState.bold}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <FormatBoldIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="斜體">
              <ToggleButton
                value="italic"
                selected={editorState.italic}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <FormatItalicIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="底線">
              <ToggleButton
                value="underline"
                selected={editorState.underline}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <FormatUnderlinedIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="下標">
              <ToggleButton
                value="subscript"
                selected={editorState.subscript}
                onClick={() => editor.chain().focus().toggleSubscript().run()}
              >
                <SubscriptIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="上標">
              <ToggleButton
                value="superscript"
                selected={editorState.superscript}
                onClick={() => editor.chain().focus().toggleSuperscript().run()}
              >
                <SuperscriptIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup
            size="small"
            exclusive
            value={editorState.align}
            onChange={(_event, value: AlignmentValue | null) => {
              if (value) editor.chain().focus().setTextAlign(value).run();
            }}
          >
            <Tooltip title="置左">
              <ToggleButton value="left">
                <FormatAlignLeftIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="置中">
              <ToggleButton value="center">
                <FormatAlignCenterIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="置右">
              <ToggleButton value="right">
                <FormatAlignRightIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            <Tooltip title={editorState.hasComment ? "編輯註解" : "加註解"}>
              <ToggleButton
                value="add-comment"
                selected={editorState.hasComment}
                onClick={handleOpenCommentDialog}
              >
                <AddCommentIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          {toolbarExtra && (
            <>
              <Divider orientation="vertical" flexItem />
              <Box sx={{ ml: "auto" }}>{toolbarExtra}</Box>
            </>
          )}
        </Stack>
      </Paper>

      <Paper
        variant="outlined"
        sx={{ p: 2, height: { xs: 420, md: 560 }, overflow: "auto" }}
      >
        <Box
          sx={[HEADING_TYPOGRAPHY_SX, COMMENT_HIGHLIGHT_SX]}
          onMouseOver={handleEditorMouseOver}
          onMouseOut={handleEditorMouseOut}
          onContextMenu={handleEditorContextMenu}
        >
          <EditorContent editor={editor} />
        </Box>
      </Paper>

      <Menu
        open={contextMenuPosition !== null}
        onClose={closeContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenuPosition
            ? { top: contextMenuPosition.y, left: contextMenuPosition.x }
            : undefined
        }
      >
        <MenuItem onClick={handleContextMenuAddOrEditComment}>
          <ListItemIcon>
            <AddCommentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {editorState.hasComment ? "編輯註解" : "加註解"}
          </ListItemText>
        </MenuItem>
        {editorState.hasComment && (
          <MenuItem onClick={handleContextMenuRemoveComment}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>移除註解</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {pendingHadExistingComment ? "編輯註解" : "加註解"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            這則註解會掛在這段文字上：「{pendingSnippet}」
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="註解內容"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 2, mb: 1 }}
          >
            底色
          </Typography>
          <Stack direction="row" spacing={1}>
            {COMMENT_COLOR_VALUES.map((color) => (
              <Tooltip key={color} title={COMMENT_COLOR_LABELS[color]}>
                <Box
                  component="button"
                  type="button"
                  aria-label={COMMENT_COLOR_LABELS[color]}
                  aria-pressed={pendingCommentColor === color}
                  onClick={() => setPendingCommentColor(color)}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "2px solid",
                    borderColor:
                      pendingCommentColor === color
                        ? "text.primary"
                        : "transparent",
                    bgcolor: COMMENT_COLOR_STYLES[color].border,
                    cursor: "pointer",
                    p: 0,
                  }}
                />
              </Tooltip>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          {pendingHadExistingComment && pendingMarkerId && (
            <Button
              color="error"
              onClick={() => handleRemoveComment(pendingMarkerId)}
              sx={{ mr: "auto" }}
            >
              移除註解
            </Button>
          )}
          <Button onClick={() => setCommentDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleConfirmComment}
            disabled={commentDraft.trim() === ""}
          >
            {pendingHadExistingComment ? "更新註解" : "新增註解"}
          </Button>
        </DialogActions>
      </Dialog>

      {hoveredComment && (
        <Box
          sx={{
            position: "fixed",
            top: hoveredComment.rect.bottom + 6,
            left: hoveredComment.rect.left,
            zIndex: 9999,
            maxWidth: 320,
            pointerEvents: "none",
          }}
        >
          <Paper elevation={8} sx={{ p: 1.5, bgcolor: "grey.900" }}>
            <Typography variant="body2" sx={{ color: "common.white" }}>
              {hoveredComment.text}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "grey.400", display: "block", mt: 0.5 }}
            >
              右鍵可編輯或移除註解
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
