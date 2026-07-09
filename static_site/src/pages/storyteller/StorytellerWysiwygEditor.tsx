import AddCommentIcon from "@mui/icons-material/AddComment";
import DeleteIcon from "@mui/icons-material/Delete";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatColorFillIcon from "@mui/icons-material/FormatColorFill";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
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

import {
  BG_COLOR_CSS,
  BG_COLOR_LABELS,
  TEXT_COLOR_CSS,
  TEXT_COLOR_LABELS,
} from "./wysiwygCore/colorStyles";
import { renderFootnoteNote } from "./wysiwygCore/footnoteRender";
import { markdownToDoc } from "./wysiwygCore/parser";
import { serializeDocToMarkdown } from "./wysiwygCore/serializer";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import {
  ALIGNMENT_VALUES,
  BG_COLOR_VALUES,
  COMMENT_COLOR_VALUES,
  DEFAULT_COMMENT_COLOR,
  DEFAULT_HEADING_LEVEL,
  HEADING_LEVELS,
  isSafeHref,
  TEXT_COLOR_VALUES,
  type AlignmentValue,
  type BgColorValue,
  type CommentColorValue,
  type HeadingLevel,
  type TextColorValue,
} from "./wysiwygCore/whitelist";
import { wysiwygCoreExtensions } from "./wysiwygCore/extensions";

interface HoveredComment {
  text: string;
  /** hover 當下該段落的 bounding rect（viewport 座標），用來把 tooltip 定位在段落正下方。 */
  rect: DOMRect;
}

interface HoveredFootnote {
  /** 這裡放的是還沒解析的腳注原文（含 **粗體** 等限縮語法），渲染時交給 renderFootnoteNote。 */
  text: string;
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
// 2026-07-09 起註解改成行內 marker（掛在選取範圍的 <span> 上，不再是整個段落），
// 高亮樣式也跟著從「段落左側色條」改成「這段文字本身的底色＋底線」，比照一般文書
// 軟體的螢光筆註解視覺；每種顏色各自一個 class（見 inlineCommentMark.ts 的 renderHTML
// 怎麼決定套用哪個 class），而不是用 inline style，這樣才能繼續透過 sx 主題化、深色模式
// 等既有機制。
const COMMENT_HIGHLIGHT_SX = {
  ...Object.fromEntries(
    COMMENT_COLOR_VALUES.map((color) => [
      `& .wysiwyg-comment-color-${color}`,
      {
        backgroundColor: COMMENT_COLOR_STYLES[color].background,
        borderBottom: `2px solid ${COMMENT_COLOR_STYLES[color].border}`,
      },
    ]),
  ),
  // 用游標樣式提示「這裡可以右鍵開編輯工具」，不用另外疊一個 tooltip——
  // hover 時已經會跳出註解內容的 tooltip 了，再加一個提示視窗只會更亂。
  "& .wysiwyg-has-comment": {
    cursor: "context-menu",
  },
} as const;

// 文字前景色／背景色的 class → 樣式對照（editor 端）。跟閱讀頁共用同一份色碼對照表
// （colorStyles.ts），只是編輯區走 class、閱讀頁走 inline style。這個跟註解高亮不同，
// 顏色是讀者也看得到的內容樣式，所以編輯區跟閱讀頁應該長得一樣。
const INLINE_COLOR_SX = {
  ...Object.fromEntries(
    TEXT_COLOR_VALUES.map((color) => [
      `& .wysiwyg-textcolor-${color}`,
      { color: TEXT_COLOR_CSS[color] },
    ]),
  ),
  ...Object.fromEntries(
    BG_COLOR_VALUES.map((color) => [
      `& .wysiwyg-bgcolor-${color}`,
      { backgroundColor: BG_COLOR_CSS[color] },
    ]),
  ),
  // 連結：跟顏色一樣「編輯區＝閱讀頁」，不是像註解那種編輯限定的樣式。
  "& .wysiwyg-link": {
    color: "primary.main",
    textDecoration: "underline",
    cursor: "pointer",
  },
} as const;

// 腳注是編輯區限定的提示樣式（跟註解一樣，閱讀頁才是真正的上標編號+尾端清單，
// 見 footnoteRender.tsx／StorytellerWysiwygMarkdown.tsx），用點狀底線跟連結的
// 實線底線區分開來，避免使用者誤以為腳注也是可以點擊跳轉的連結。
const FOOTNOTE_HIGHLIGHT_SX = {
  "& .wysiwyg-has-footnote": {
    textDecorationLine: "underline",
    textDecorationStyle: "dotted",
    cursor: "help",
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
  const [textColorAnchor, setTextColorAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [bgColorAnchor, setBgColorAnchor] = useState<HTMLElement | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [hrefDraft, setHrefDraft] = useState("");
  const [openInNewTab, setOpenInNewTab] = useState(false);
  const [pendingHadExistingLink, setPendingHadExistingLink] = useState(false);
  const [footnoteDialogOpen, setFootnoteDialogOpen] = useState(false);
  const [footnoteDraft, setFootnoteDraft] = useState("");
  const [pendingHadExistingFootnote, setPendingHadExistingFootnote] =
    useState(false);
  const [hoveredFootnote, setHoveredFootnote] =
    useState<HoveredFootnote | null>(null);

  const editor = useEditor({
    extensions: wysiwygCoreExtensions,
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
          hasSelection: false,
          textColor: null as TextColorValue | null,
          bgColor: null as BgColorValue | null,
          hasLink: false,
          hasFootnote: false,
        };
      }
      const align =
        ALIGNMENT_VALUES.find((v) => ctx.editor!.isActive({ textAlign: v })) ??
        "left";
      const headingLevel =
        HEADING_LEVELS.find((level) =>
          ctx.editor!.isActive("paragraph", { headingLevel: level }),
        ) ?? DEFAULT_HEADING_LEVEL;
      const textColor =
        TEXT_COLOR_VALUES.find((value) =>
          ctx.editor!.isActive("textColor", { value }),
        ) ?? null;
      const bgColor =
        BG_COLOR_VALUES.find((value) =>
          ctx.editor!.isActive("bgColor", { value }),
        ) ?? null;
      return {
        bold: ctx.editor.isActive("bold"),
        italic: ctx.editor.isActive("italic"),
        underline: ctx.editor.isActive("underline"),
        subscript: ctx.editor.isActive("subscript"),
        superscript: ctx.editor.isActive("superscript"),
        align,
        headingLevel,
        hasComment: ctx.editor.isActive("comment"),
        hasSelection: !ctx.editor.state.selection.empty,
        textColor,
        bgColor,
        hasLink: ctx.editor.isActive("link"),
        hasFootnote: ctx.editor.isActive("footnote"),
      };
    },
  });

  if (!editor || !editorState) {
    return null;
  }

  // 跟連結/腳注一樣：游標落在既有註解中間時，getAttributes 就能讀到目前生效的
  // comment/commentColor，帶出來預填，讓「編輯註解」跟「加註解」共用同一個 Dialog。
  // 註解改成行內 marker 之後，snippet 直接取「目前實際選取的文字」——比舊版「段落開頭
  // 24 字」更準確，因為現在真的是針對這段選取範圍加註解，不是針對整個段落。
  const handleOpenCommentDialog = () => {
    const attrs = editor.getAttributes("comment");
    const existingComment = attrs.comment as string | undefined;
    const existingColor = attrs.commentColor as CommentColorValue | undefined;
    const { from, to } = editor.state.selection;
    setPendingHadExistingComment(Boolean(existingComment));
    setPendingSnippet(editor.state.doc.textBetween(from, to, " ").slice(0, 24));
    setCommentDraft(existingComment ?? "");
    setPendingCommentColor(existingColor ?? DEFAULT_COMMENT_COLOR);
    setCommentDialogOpen(true);
  };

  // extendMarkRange 原因同連結/腳注：避免游標只是落在註解中間（沒有主動選取整段文字）時，
  // setComment 只套用到空選取範圍，等於沒改到既有註解。
  const handleConfirmComment = () => {
    if (commentDraft.trim() === "") return;
    editor
      .chain()
      .focus()
      .extendMarkRange("comment")
      .setComment({
        comment: commentDraft.trim(),
        commentColor: pendingCommentColor,
      })
      .run();
    setCommentDialogOpen(false);
  };

  const handleRemoveComment = () => {
    editor.chain().focus().extendMarkRange("comment").unsetComment().run();
    setCommentDialogOpen(false);
  };

  // hover 在編輯區內任何地方時，往上找最近的 .wysiwyg-has-comment（事件代理，不用替
  // 每個註解範圍個別掛 listener）。註解文字直接讀 InlineComment mark 的 renderHTML
  // 附加的 data-comment，定位資訊用 getBoundingClientRect()，所以 tooltip 用
  // position: fixed 直接對齊。
  const handleEditorMouseOver = (event: MouseEvent<HTMLDivElement>) => {
    const eventTarget = event.target as HTMLElement;

    const commentTarget = eventTarget.closest<HTMLElement>(
      ".wysiwyg-has-comment",
    );
    const comment = commentTarget?.dataset.comment;
    if (commentTarget && comment) {
      setHoveredComment({
        text: comment,
        rect: commentTarget.getBoundingClientRect(),
      });
    }

    const footnoteTarget = eventTarget.closest<HTMLElement>(
      ".wysiwyg-has-footnote",
    );
    const note = footnoteTarget?.dataset.note;
    if (footnoteTarget && note) {
      setHoveredFootnote({
        text: note,
        rect: footnoteTarget.getBoundingClientRect(),
      });
    }
  };

  const handleEditorMouseOut = (event: MouseEvent<HTMLDivElement>) => {
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!relatedTarget?.closest(".wysiwyg-has-comment")) {
      setHoveredComment(null);
    }
    if (!relatedTarget?.closest(".wysiwyg-has-footnote")) {
      setHoveredFootnote(null);
    }
  };

  // 右鍵點哪裡，就把選取範圍移到那個位置（posAtCoords 換算螢幕座標成文件內位置），
  // 不管那段目前有沒有註解都適用——不像 hover 高亮，只有已經有註解的段落才有
  // .wysiwyg-has-comment 可以定位，右鍵選單要對「還沒加註解」的段落也能開。
  //
  // 但如果使用者已經選了一段文字、在選取範圍「裡面」按右鍵（想對這段文字套格式），
  // 不能把選取範圍收合成右鍵點的那個單一位置——不然選取範圍就沒了，右鍵選單裡的
  // 粗體/顏色/連結等動作會套用到「空選取」上，等於失效。只有右鍵點在選取範圍「外面」
  // 時才收合成單點（沿用原本「右鍵任何地方都能開加註解選單」的行為）。
  const handleEditorContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const result = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!result) return;
    const { from, to } = editor.state.selection;
    const clickedInsideSelection = result.pos >= from && result.pos <= to;
    if (!clickedInsideSelection) {
      editor.commands.setTextSelection(result.pos);
    }
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => setContextMenuPosition(null);

  const handleContextMenuAddOrEditComment = () => {
    closeContextMenu();
    handleOpenCommentDialog();
  };

  const handleContextMenuRemoveComment = () => {
    closeContextMenu();
    handleRemoveComment();
  };

  // 文字顏色／背景色都是行內 mark，套在目前的選取範圍上（沒有選取時 setMark 會套在
  // 之後鍵入的文字上，跟粗體等行為一致）。選 null 代表清除。
  const applyTextColor = (value: TextColorValue | null) => {
    setTextColorAnchor(null);
    if (value === null) {
      editor.chain().focus().unsetTextColor().run();
    } else {
      editor.chain().focus().setTextColor(value).run();
    }
  };

  const applyBgColor = (value: BgColorValue | null) => {
    setBgColorAnchor(null);
    if (value === null) {
      editor.chain().focus().unsetBgColor().run();
    } else {
      editor.chain().focus().setBgColor(value).run();
    }
  };

  // 開連結 Dialog：如果游標目前就在一個既有連結裡，把 href/target 帶出來預填，
  // 這樣「編輯連結」跟「新增連結」共用同一個 Dialog，使用者不用先移除再重加。
  const handleOpenLinkDialog = () => {
    const existingHref = editor.getAttributes("link").href as
      string | undefined;
    const existingTarget = editor.getAttributes("link").target as
      string | undefined;
    setPendingHadExistingLink(Boolean(existingHref));
    setHrefDraft(existingHref ?? "");
    setOpenInNewTab(existingTarget === "_blank");
    setLinkDialogOpen(true);
  };

  // extendMarkRange 先把選取範圍延伸到涵蓋整個既有連結——不然編輯連結時，如果游標只是
  // 落在連結中間（沒有主動選取整段文字），setLink 只會套用到目前的空選取範圍，等於沒改到。
  const handleConfirmLink = () => {
    const href = hrefDraft.trim();
    if (!isSafeHref(href)) return;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href, target: openInNewTab ? "_blank" : undefined })
      .run();
    setLinkDialogOpen(false);
  };

  const handleRemoveLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkDialogOpen(false);
  };

  // 跟連結一樣：游標落在既有腳注中間時，getAttributes 就能讀到目前生效的 note，
  // 帶出來預填，讓「編輯腳注」跟「加腳注」共用同一個 Dialog。
  const handleOpenFootnoteDialog = () => {
    const existingNote = editor.getAttributes("footnote").note as
      string | undefined;
    setPendingHadExistingFootnote(Boolean(existingNote));
    setFootnoteDraft(existingNote ?? "");
    setFootnoteDialogOpen(true);
  };

  // extendMarkRange 原因同連結：避免游標只是落在腳注中間（沒有主動選取整段文字）時，
  // setFootnote 只套用到空選取範圍，等於沒改到既有腳注。
  const handleConfirmFootnote = () => {
    const note = footnoteDraft.trim();
    if (note === "") return;
    editor
      .chain()
      .focus()
      .extendMarkRange("footnote")
      .setFootnote({ note })
      .run();
    setFootnoteDialogOpen(false);
  };

  const handleRemoveFootnote = () => {
    editor.chain().focus().extendMarkRange("footnote").unsetFootnote().run();
    setFootnoteDialogOpen(false);
  };

  const activeMarks = [
    editorState.bold && "bold",
    editorState.italic && "italic",
    editorState.underline && "underline",
    editorState.subscript && "subscript",
    editorState.superscript && "superscript",
  ].filter(Boolean) as string[];

  // 註解是行內 marker，套用在「一段選取的文字」上，不像以前的段落屬性版本可以在空
  // 選取（只有游標）時也套用到整個段落——所以「加註解」只有在真的選了文字，或游標
  // 已經落在既有註解裡（此時是要編輯/移除，不是新增）時才能開。
  const canOpenCommentDialog =
    editorState.hasComment || editorState.hasSelection;

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
            <Tooltip title="文字顏色">
              <ToggleButton
                value="text-color"
                selected={editorState.textColor !== null}
                onClick={(event) => setTextColorAnchor(event.currentTarget)}
              >
                <FormatColorTextIcon
                  fontSize="small"
                  sx={{
                    color: editorState.textColor
                      ? TEXT_COLOR_CSS[editorState.textColor]
                      : undefined,
                  }}
                />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="文字背景色">
              <ToggleButton
                value="bg-color"
                selected={editorState.bgColor !== null}
                onClick={(event) => setBgColorAnchor(event.currentTarget)}
              >
                <FormatColorFillIcon
                  fontSize="small"
                  sx={{
                    color: editorState.bgColor
                      ? BG_COLOR_CSS[editorState.bgColor]
                      : undefined,
                  }}
                />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            <Tooltip title={editorState.hasLink ? "編輯連結" : "加連結"}>
              <ToggleButton
                value="link"
                selected={editorState.hasLink}
                onClick={handleOpenLinkDialog}
              >
                <LinkIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            <Tooltip title={editorState.hasFootnote ? "編輯腳注" : "加腳注"}>
              <ToggleButton
                value="footnote"
                selected={editorState.hasFootnote}
                onClick={handleOpenFootnoteDialog}
              >
                <NoteAltIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            <Tooltip
              title={
                editorState.hasComment
                  ? "編輯註解"
                  : canOpenCommentDialog
                    ? "加註解"
                    : "請先選取要加註解的文字"
              }
            >
              <span>
                <ToggleButton
                  value="add-comment"
                  selected={editorState.hasComment}
                  disabled={!canOpenCommentDialog}
                  onClick={handleOpenCommentDialog}
                >
                  <AddCommentIcon fontSize="small" />
                </ToggleButton>
              </span>
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
          sx={[
            HEADING_TYPOGRAPHY_SX,
            COMMENT_HIGHLIGHT_SX,
            INLINE_COLOR_SX,
            FOOTNOTE_HIGHLIGHT_SX,
          ]}
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
        <MenuItem
          selected={editorState.bold}
          onClick={() => {
            editor.chain().focus().toggleBold().run();
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <FormatBoldIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>粗體</ListItemText>
        </MenuItem>
        <MenuItem
          selected={editorState.italic}
          onClick={() => {
            editor.chain().focus().toggleItalic().run();
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <FormatItalicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>斜體</ListItemText>
        </MenuItem>
        <MenuItem
          selected={editorState.underline}
          onClick={() => {
            editor.chain().focus().toggleUnderline().run();
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <FormatUnderlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>底線</ListItemText>
        </MenuItem>
        <MenuItem
          selected={editorState.subscript}
          onClick={() => {
            editor.chain().focus().toggleSubscript().run();
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <SubscriptIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>下標</ListItemText>
        </MenuItem>
        <MenuItem
          selected={editorState.superscript}
          onClick={() => {
            editor.chain().focus().toggleSuperscript().run();
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <SuperscriptIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>上標</ListItemText>
        </MenuItem>

        <Divider />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, pt: 1 }}
        >
          文字顏色
        </Typography>
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1 }}>
          {TEXT_COLOR_VALUES.map((color) => (
            <Tooltip key={color} title={TEXT_COLOR_LABELS[color]}>
              <Box
                component="button"
                type="button"
                aria-label={TEXT_COLOR_LABELS[color]}
                aria-pressed={editorState.textColor === color}
                onClick={() => {
                  applyTextColor(color);
                  closeContextMenu();
                }}
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor:
                    editorState.textColor === color
                      ? "text.primary"
                      : "divider",
                  bgcolor: TEXT_COLOR_CSS[color],
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        <MenuItem
          onClick={() => {
            applyTextColor(null);
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>清除文字顏色</ListItemText>
        </MenuItem>

        <Divider />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 2, pt: 1 }}
        >
          文字背景色
        </Typography>
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1 }}>
          {BG_COLOR_VALUES.map((color) => (
            <Tooltip key={color} title={BG_COLOR_LABELS[color]}>
              <Box
                component="button"
                type="button"
                aria-label={BG_COLOR_LABELS[color]}
                aria-pressed={editorState.bgColor === color}
                onClick={() => {
                  applyBgColor(color);
                  closeContextMenu();
                }}
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor:
                    editorState.bgColor === color ? "text.primary" : "divider",
                  bgcolor: BG_COLOR_CSS[color],
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        <MenuItem
          onClick={() => {
            applyBgColor(null);
            closeContextMenu();
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>清除背景色</ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            closeContextMenu();
            handleOpenLinkDialog();
          }}
        >
          <ListItemIcon>
            <LinkIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {editorState.hasLink ? "編輯連結" : "加連結"}
          </ListItemText>
        </MenuItem>

        <Divider />

        <MenuItem
          onClick={() => {
            closeContextMenu();
            handleOpenFootnoteDialog();
          }}
        >
          <ListItemIcon>
            <NoteAltIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {editorState.hasFootnote ? "編輯腳注" : "加腳注"}
          </ListItemText>
        </MenuItem>
        {editorState.hasFootnote && (
          <MenuItem
            onClick={() => {
              closeContextMenu();
              handleRemoveFootnote();
            }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>移除腳注</ListItemText>
          </MenuItem>
        )}

        <Divider />

        <MenuItem
          onClick={handleContextMenuAddOrEditComment}
          disabled={!canOpenCommentDialog}
        >
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

      <Menu
        open={textColorAnchor !== null}
        anchorEl={textColorAnchor}
        onClose={() => setTextColorAnchor(null)}
      >
        <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1 }}>
          {TEXT_COLOR_VALUES.map((color) => (
            <Tooltip key={color} title={TEXT_COLOR_LABELS[color]}>
              <Box
                component="button"
                type="button"
                aria-label={TEXT_COLOR_LABELS[color]}
                aria-pressed={editorState.textColor === color}
                onClick={() => applyTextColor(color)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor:
                    editorState.textColor === color
                      ? "text.primary"
                      : "divider",
                  bgcolor: TEXT_COLOR_CSS[color],
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        <MenuItem onClick={() => applyTextColor(null)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>清除文字顏色</ListItemText>
        </MenuItem>
      </Menu>

      <Menu
        open={bgColorAnchor !== null}
        anchorEl={bgColorAnchor}
        onClose={() => setBgColorAnchor(null)}
      >
        <Stack direction="row" spacing={1} sx={{ px: 1.5, py: 1 }}>
          {BG_COLOR_VALUES.map((color) => (
            <Tooltip key={color} title={BG_COLOR_LABELS[color]}>
              <Box
                component="button"
                type="button"
                aria-label={BG_COLOR_LABELS[color]}
                aria-pressed={editorState.bgColor === color}
                onClick={() => applyBgColor(color)}
                sx={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "2px solid",
                  borderColor:
                    editorState.bgColor === color ? "text.primary" : "divider",
                  bgcolor: BG_COLOR_CSS[color],
                  cursor: "pointer",
                  p: 0,
                }}
              />
            </Tooltip>
          ))}
        </Stack>
        <MenuItem onClick={() => applyBgColor(null)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>清除背景色</ListItemText>
        </MenuItem>
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
          {pendingSnippet && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              這則註解會掛在這段文字上：「{pendingSnippet}」
            </Typography>
          )}
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
          {pendingHadExistingComment && (
            <Button
              color="error"
              onClick={handleRemoveComment}
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

      <Dialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {pendingHadExistingLink ? "編輯連結" : "加連結"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="網址"
            placeholder="https://..."
            value={hrefDraft}
            onChange={(event) => setHrefDraft(event.target.value)}
            error={hrefDraft.trim() !== "" && !isSafeHref(hrefDraft.trim())}
            helperText={
              hrefDraft.trim() !== "" && !isSafeHref(hrefDraft.trim())
                ? "只接受 http:// 或 https:// 開頭的網址（暫不支援站內連結）"
                : undefined
            }
          />
          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={openInNewTab}
                onChange={(event) => setOpenInNewTab(event.target.checked)}
              />
            }
            label="在新分頁開啟"
          />
        </DialogContent>
        <DialogActions>
          {pendingHadExistingLink && (
            <Button
              color="error"
              onClick={handleRemoveLink}
              startIcon={<LinkOffIcon fontSize="small" />}
              sx={{ mr: "auto" }}
            >
              移除連結
            </Button>
          )}
          <Button onClick={() => setLinkDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleConfirmLink}
            disabled={!isSafeHref(hrefDraft.trim())}
          >
            {pendingHadExistingLink ? "更新連結" : "新增連結"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={footnoteDialogOpen}
        onClose={() => setFootnoteDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {pendingHadExistingFootnote ? "編輯腳注" : "加腳注"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={3}
            label="腳注內容"
            value={footnoteDraft}
            onChange={(event) => setFootnoteDraft(event.target.value)}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mt: 1 }}
          >
            只支援 **粗體**、*斜體*、++底線++，其餘格式不會被套用
          </Typography>
        </DialogContent>
        <DialogActions>
          {pendingHadExistingFootnote && (
            <Button
              color="error"
              onClick={handleRemoveFootnote}
              sx={{ mr: "auto" }}
            >
              移除腳注
            </Button>
          )}
          <Button onClick={() => setFootnoteDialogOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleConfirmFootnote}
            disabled={footnoteDraft.trim() === ""}
          >
            {pendingHadExistingFootnote ? "更新腳注" : "新增腳注"}
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

      {hoveredFootnote && (
        <Box
          sx={{
            position: "fixed",
            top: hoveredFootnote.rect.bottom + 6,
            left: hoveredFootnote.rect.left,
            zIndex: 9999,
            maxWidth: 320,
            pointerEvents: "none",
          }}
        >
          <Paper elevation={8} sx={{ p: 1.5, bgcolor: "grey.900" }}>
            <Typography variant="body2" sx={{ color: "common.white" }}>
              {renderFootnoteNote(hoveredFootnote.text)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: "grey.400", display: "block", mt: 0.5 }}
            >
              右鍵可編輯或移除腳注
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
