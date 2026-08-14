import DeleteIcon from "@mui/icons-material/Delete";
import FormatColorFillIcon from "@mui/icons-material/FormatColorFill";
import FormatColorTextIcon from "@mui/icons-material/FormatColorText";
import LinkOffIcon from "@mui/icons-material/LinkOff";
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
  forwardRef,
  useImperativeHandle,
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
import {
  wysiwygCommandsByGroup,
  type WysiwygCommandContext,
} from "./wysiwygCore/commands";
import {
  buildExportFileName,
  exportContentToMarkdown,
} from "./wysiwygCore/exportMarkdown";
import { renderFootnoteNote } from "./wysiwygCore/footnoteRender";
import { markdownToDoc } from "./wysiwygCore/parser";
import { serializeDocToMarkdown } from "./wysiwygCore/serializer";
import { HEADING_TYPOGRAPHY_SX } from "./wysiwygCore/typographySx";
import {
  ALIGNMENT_VALUES,
  BG_COLOR_VALUES,
  BLOCK_KIND_VALUES,
  COMMENT_COLOR_VALUES,
  DEFAULT_BLOCK_KIND,
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
import { StorytellerWysiwygBubbleMenu } from "./StorytellerWysiwygBubbleMenu";
import {
  StorytellerWysiwygContextMenu,
  type ContextMenuPosition,
} from "./StorytellerWysiwygContextMenu";
import { StorytellerWysiwygSyntaxDrawer } from "./StorytellerWysiwygSyntaxDrawer";

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

// 引用/清單（blockKind）2026-07-10 加入：編輯區的段落 schema 是扁平的（每個段落都是
// 獨立的 <p> node，沒有真的 <blockquote>/<ul>/<ol> 巢狀，見 markerParagraph.ts 的說明），
// 所以「連續同 blockKind 的段落看起來像一個整體」純粹是 CSS 錯覺：相鄰同 data-block-kind
// 的段落靠一致的縮排/裝飾字元營造出視覺分組，不是真的 DOM 巢狀（閱讀頁 StorytellerWysiwygMarkdown.tsx
// 才是真的巢狀渲染，見那邊的分組邏輯）。有序清單的編號用 CSS counter 自動算，不用 JS
// 手動追蹤——每個 [data-block-kind="number"] 段落遞增 counter，只有在「前一個相鄰兄弟
// 不是 number」（進入一組新的清單）或「本身是第一個子元素」時才重置成 0。
const BLOCK_KIND_SX = {
  "& [data-block-kind='quote']": {
    borderLeft: "4px solid",
    borderColor: "divider",
    paddingLeft: "12px",
    fontStyle: "italic",
    color: "text.secondary",
  },
  "& [data-block-kind='bullet'], & [data-block-kind='number']": {
    position: "relative",
    paddingLeft: "24px",
  },
  "& [data-block-kind='bullet']::before": {
    content: '"•"',
    position: "absolute",
    left: "8px",
  },
  "& [data-block-kind='number']": {
    counterIncrement: "storyteller-ordered-list",
  },
  "& [data-block-kind='number']::before": {
    content: 'counter(storyteller-ordered-list) ". "',
    position: "absolute",
    left: 0,
  },
  "& :not([data-block-kind='number']) + [data-block-kind='number']": {
    counterReset: "storyteller-ordered-list",
  },
  "& [data-block-kind='number']:first-child": {
    counterReset: "storyteller-ordered-list",
  },
  // 分隔線本身不接受行內內容（見 markerParagraph.ts 的 insertHorizontalRule 說明），這裡
  // 只是防禦性地把文字視覺隱藏（萬一有舊資料或極端操作讓文字混進這個段落），真正畫出來
  // 的線是 border-top，不是靠段落的文字內容。
  "& [data-block-kind='hr']": {
    minHeight: "1em",
    margin: "0.5em 0",
    borderTop: "1px solid",
    borderColor: "divider",
    fontSize: 0,
    lineHeight: 0,
  },
  // 表格列在編輯區就是一般文字段落，`|` 是使用者自己打出來的字面字元（見 whitelist.ts 的
  // BLOCK_KIND_TABLE_ROW_PREFIX 說明，編輯區故意不做真的表格網格），這裡只用底色/等寬字體
  // 給一個「這是表格列」的視覺提示，不是真的欄位邊界。
  "& [data-block-kind='table-row']": {
    fontFamily: "monospace",
    backgroundColor: "action.hover",
    borderRadius: "4px",
    padding: "2px 6px",
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
  /** 資產 node 用來查詢同專案 preview URL；不提供時只會顯示 asset id 佔位。 */
  projectPublicId?: string;
  /**
   * 匯出檔名的基底（通常是故事/設定集標題，編輯器自己不知道標題，由頁面層提供）。
   * 有提供才會在工具列顯示「匯出 markdown」按鈕；實際檔名是
   * `[標題]_[timestamp].md`（見 buildExportFileName），timestamp 在按下當下才產生。
   * 匯出內容是把自訂白名單語法轉成標準 markdown（見 exportMarkdown.ts 的轉換規則），
   * 不是原始 content——原始格式含內部 marker 語法，不該外洩。
   */
  exportBaseName?: string;
  /**
   * 白名單：只列出的功能才會啟用，不提供（undefined）就全部啟用——維持既有頁面
   * （StoryEditor／LoreEditor）行為不變。目前支援腳注／註解／資產圖片開關，其餘工具列
   * 功能不受影響。
   */
  enabledFeatures?: Array<"footnote" | "comment" | "asset">;
  /**
   * 觸發頁面層開啟資產選擇 Dialog（Phase 2：插入資產 command 化）。asset picker 本身
   * 是頁面層的 state（StoryEditor／LoreEditor 各自的 `assetPickerOpen`），這個元件
   * 不持有、也不查 API，只在 slash／右鍵選單的「插入圖片」command 被觸發時呼叫這個
   * callback，選好之後頁面層照舊呼叫 `ref.current.insertAsset(...)`。沒提供這個 prop
   * 就代表沒有插入圖片的入口（跟 footnote/comment 的 isFeatureEnabled 開關是分開的
   * 兩件事：`enabledFeatures` 控制「要不要開放這個功能」，這個 prop 控制「有沒有實際
   * 可用的插入管道」）。
   */
  onRequestInsertAsset?: () => void;
}

export interface StorytellerWysiwygEditorHandle {
  insertAsset: (asset: {
    publicId: string;
    src?: string;
    alt?: string;
    projectPublicId?: string;
  }) => boolean;
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
export const StorytellerWysiwygEditor = forwardRef<
  StorytellerWysiwygEditorHandle,
  StorytellerWysiwygEditorProps
>(function StorytellerWysiwygEditor(
  {
    value,
    onChange,
    toolbarExtra,
    projectPublicId,
    exportBaseName,
    enabledFeatures,
    onRequestInsertAsset,
  },
  ref,
) {
  const isFeatureEnabled = (feature: "footnote" | "comment" | "asset") =>
    enabledFeatures === undefined || enabledFeatures.includes(feature);
  const assetEnabled = isFeatureEnabled("asset");
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

  const isComposingRef = useRef(false);
  const latestValueRef = useRef(value);
  latestValueRef.current = value;

  const editor = useEditor({
    extensions: wysiwygCoreExtensions,
    content: markdownToDoc(value, projectPublicId, assetEnabled),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        style: "min-height: 320px; outline: none;",
      },
      // 白名單規則：不接受任何 HTML 內容。無論剪貼簿裡帶了什麼樣式，
      // 一律只取 text/plain 內容當純文字插入，貼上後格式跑掉是可接受的結果。
      // 貼上的文字可能帶有換行（例如從其他網站複製多行內容），每個換行都要變成真正的
      // 段落分割（配新 markerId），不能讓 \n 原封不動塞進單一段落的文字內容裡——那樣
      // 會跟「一個 \n＝一個段落」的序列化假設對不上，存檔後段落 marker 會露出來變成
      // 可見文字（見 DevelopDocuments/storyteller/所見即所得編輯器_issue.md）。
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain") ?? "";
        if (text === "") return false;
        event.preventDefault();
        text.split(/\r\n|\r|\n/).forEach((line, index) => {
          if (index > 0) editor?.commands.splitParagraphFresh();
          if (line !== "") view.dispatch(view.state.tr.insertText(line));
        });
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

  // 注音／拼音等 IME 選字期間，瀏覽器會用 compositionstart～compositionend 包住整段合成
  // 輸入；這段期間如果外部同步呼叫 editor.commands.setContent 整份換掉 ProseMirror 文件，
  // 會打斷合成中的 DOM 節點，導致游標跳到文件最後，或是把還沒選字的注音符號原樣提交
  // 成文字。IME 合成中先記下來延後處理，等 compositionend 再用當下最新的 value 補做一次
  // 同步（而不是用合成開始當下快照的舊值，避免蓋掉使用者剛選好的字）。
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const syncFromLatestValue = () => {
      if (latestValueRef.current === lastEmittedRef.current) return;
      lastEmittedRef.current = latestValueRef.current;
      editor.commands.setContent(
        markdownToDoc(latestValueRef.current, projectPublicId, assetEnabled),
      );
    };
    const handleCompositionStart = () => {
      isComposingRef.current = true;
    };
    const handleCompositionEnd = () => {
      isComposingRef.current = false;
      syncFromLatestValue();
    };
    dom.addEventListener("compositionstart", handleCompositionStart);
    dom.addEventListener("compositionend", handleCompositionEnd);
    return () => {
      dom.removeEventListener("compositionstart", handleCompositionStart);
      dom.removeEventListener("compositionend", handleCompositionEnd);
    };
  }, [editor, projectPublicId, assetEnabled]);

  useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    if (isComposingRef.current) return;
    lastEmittedRef.current = value;
    editor.commands.setContent(
      markdownToDoc(value, projectPublicId, assetEnabled),
    );
  }, [value, projectPublicId, assetEnabled, editor]);

  useImperativeHandle(
    ref,
    () => ({
      insertAsset: (asset) => {
        if (!editor || !assetEnabled || !asset.publicId) return false;
        return editor
          .chain()
          .focus()
          .insertContent([
            {
              type: "paragraph",
              attrs: { markerId: "", headingLevel: 0, blockKind: "none" },
              content: [
                {
                  type: "assetImage",
                  attrs: {
                    publicId: asset.publicId,
                    src: asset.src ?? "",
                    alt: asset.alt ?? "",
                    projectPublicId:
                      asset.projectPublicId ?? projectPublicId ?? "",
                  },
                },
              ],
            },
          ])
          .run();
      },
    }),
    [assetEnabled, editor, projectPublicId],
  );

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
          strike: false,
          align: "left" as AlignmentValue,
          headingLevel: DEFAULT_HEADING_LEVEL,
          blockKind: DEFAULT_BLOCK_KIND,
          hasComment: false,
          hasSelection: false,
          isCurrentParagraphEmpty: true,
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
      const blockKind =
        BLOCK_KIND_VALUES.find(
          (kind) =>
            kind !== DEFAULT_BLOCK_KIND &&
            ctx.editor!.isActive("paragraph", { blockKind: kind }),
        ) ?? DEFAULT_BLOCK_KIND;
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
        strike: ctx.editor.isActive("strike"),
        align,
        headingLevel,
        blockKind,
        hasComment: ctx.editor.isActive("comment"),
        hasSelection: !ctx.editor.state.selection.empty,
        // 空白段落／非空段落是 Phase 2 右鍵選單分情境的判斷依據。故意不用
        // textContent.trim() === ""（那個算法只看文字，asset image 是沒有文字的
        // inline atom node，只用 textContent 判斷會把「只有一張圖片的段落」誤判成
        // 空白段落，導致對著既有圖片右鍵還跳出「插入圖片」選項）。改用 content.size
        // === 0，這是 ProseMirror 對「這個節點底下完全沒有子節點」的定義，atom node
        // 即使沒有文字也會貢獻自己的 nodeSize，size 就不會是 0。
        isCurrentParagraphEmpty:
          ctx.editor.state.selection.$from.parent.content.size === 0,
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

  // 匯出標準 markdown 檔：value 是父層同步回來的最新內容（onUpdate → onChange →
  // 父層 state → value prop），不用另外從 editor 重新序列化。純前端下載，不經後端。
  const handleExportMarkdown = () => {
    const markdown = exportContentToMarkdown(value);
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = buildExportFileName(exportBaseName ?? "");
    anchor.click();
    URL.revokeObjectURL(url);
  };

  // Command Registry（wysiwygCore/commands.ts）共用的執行環境：工具列／右鍵選單都靠
  // 同一份 context 呼叫 command.run，不再各自寫一份 onClick。dialog 開關動作（連結／
  // 腳注／註解）本來就是這個元件自己的 useState，command 只是呼叫這幾個既有 handler，
  // 不重新實作對話框邏輯。
  const commandContext: WysiwygCommandContext = {
    isFeatureEnabled,
    canExportMarkdown: exportBaseName !== undefined,
    canInsertAsset: assetEnabled && onRequestInsertAsset !== undefined,
    openLinkDialog: handleOpenLinkDialog,
    openFootnoteDialog: handleOpenFootnoteDialog,
    openCommentDialog: handleOpenCommentDialog,
    openAssetPicker: () => onRequestInsertAsset?.(),
    exportMarkdown: handleExportMarkdown,
  };

  const activeMarkIds = wysiwygCommandsByGroup("mark")
    .filter((command) => command.isActive?.(editor))
    .map((command) => command.id);

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
            value={activeMarkIds}
            onChange={() => {}}
          >
            {wysiwygCommandsByGroup("mark").map((command) => {
              const Icon = command.icon!;
              return (
                <Tooltip key={command.id} title={command.label}>
                  <ToggleButton
                    value={command.id}
                    selected={command.isActive?.(editor) ?? false}
                    onClick={() => command.run(editor, commandContext)}
                  >
                    <Icon fontSize="small" />
                  </ToggleButton>
                </Tooltip>
              );
            })}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            {wysiwygCommandsByGroup("align").map((command) => {
              const Icon = command.icon!;
              return (
                <Tooltip key={command.id} title={command.label}>
                  <ToggleButton
                    value={command.id}
                    selected={command.isActive?.(editor) ?? false}
                    onClick={() => command.run(editor, commandContext)}
                  >
                    <Icon fontSize="small" />
                  </ToggleButton>
                </Tooltip>
              );
            })}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem />

          <ToggleButtonGroup size="small">
            {wysiwygCommandsByGroup("block").map((command) => {
              const Icon = command.icon!;
              return (
                <Tooltip key={command.id} title={command.label}>
                  <ToggleButton
                    value={command.id}
                    selected={command.isActive?.(editor) ?? false}
                    onClick={() => command.run(editor, commandContext)}
                  >
                    <Icon fontSize="small" />
                  </ToggleButton>
                </Tooltip>
              );
            })}
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

          {wysiwygCommandsByGroup("annotation")
            .filter((command) => command.isVisible?.(commandContext) ?? true)
            .map((command) => {
              const Icon = command.icon!;
              const isActive = command.isActive?.(editor) ?? false;
              const isEnabled = command.isEnabled?.(editor, commandContext) ?? true;
              const label = isActive && command.activeLabel
                ? command.activeLabel
                : command.label;
              const tooltip =
                command.id === "comment" && !isEnabled
                  ? "請先選取要加註解的文字"
                  : label;
              return (
                <Box
                  key={command.id}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Divider orientation="vertical" flexItem sx={{ mr: 2 }} />
                  <ToggleButtonGroup size="small">
                    <Tooltip title={tooltip}>
                      <span>
                        <ToggleButton
                          value={command.id}
                          selected={isActive}
                          disabled={!isEnabled}
                          onClick={() => command.run(editor, commandContext)}
                        >
                          <Icon fontSize="small" />
                        </ToggleButton>
                      </span>
                    </Tooltip>
                  </ToggleButtonGroup>
                </Box>
              );
            })}

          {wysiwygCommandsByGroup("utility")
            .filter((command) => command.isVisible?.(commandContext) ?? true)
            .map((command) => {
              const Icon = command.icon!;
              return (
                <Box
                  key={command.id}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Divider orientation="vertical" flexItem sx={{ mr: 2 }} />
                  <ToggleButtonGroup size="small">
                    <Tooltip title={command.label}>
                      <ToggleButton
                        value={command.id}
                        onClick={() => command.run(editor, commandContext)}
                      >
                        <Icon fontSize="small" />
                      </ToggleButton>
                    </Tooltip>
                  </ToggleButtonGroup>
                </Box>
              );
            })}

          <Divider orientation="vertical" flexItem />
          <StorytellerWysiwygSyntaxDrawer enabledFeatures={enabledFeatures} />

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
            BLOCK_KIND_SX,
          ]}
          onMouseOver={handleEditorMouseOver}
          onMouseOut={handleEditorMouseOut}
          onContextMenu={handleEditorContextMenu}
        >
          <EditorContent editor={editor} />
          <StorytellerWysiwygBubbleMenu
            editor={editor}
            commandContext={commandContext}
          />
        </Box>
      </Paper>

      <StorytellerWysiwygContextMenu
        editor={editor}
        position={contextMenuPosition}
        onClose={closeContextMenu}
        commandContext={commandContext}
        onRemoveLink={handleRemoveLink}
        onRemoveFootnote={handleRemoveFootnote}
        onRemoveComment={handleRemoveComment}
        hasLink={editorState.hasLink}
        hasFootnote={editorState.hasFootnote}
        hasComment={editorState.hasComment}
        hasSelection={editorState.hasSelection}
        isCurrentParagraphEmpty={editorState.isCurrentParagraphEmpty}
      />

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
});
