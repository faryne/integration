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
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  type MouseEvent,
  type ReactNode,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
} from "react";

import { BG_COLOR_CSS, TEXT_COLOR_CSS } from "./wysiwygCore/colorStyles";
import { CLEAR_FLOATING_ASSET_SX } from "./wysiwygCore/assetImageLayout";
import {
  hasAssetImageLayoutTarget,
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
  BG_COLOR_VALUES,
  COMMENT_COLOR_VALUES,
  DEFAULT_COMMENT_COLOR,
  isSafeHref,
  TEXT_COLOR_VALUES,
  type CommentColorValue,
} from "./wysiwygCore/whitelist";
import { createWysiwygCoreExtensions } from "./wysiwygCore/extensions";
import { StorytellerWysiwygBubbleMenu } from "./StorytellerWysiwygBubbleMenu";
import {
  StorytellerWysiwygContextMenu,
  type ContextMenuPosition,
  type StorytellerSelectionAgentDialogItem,
} from "./StorytellerWysiwygContextMenu";
import { StorytellerWysiwygSyntaxDrawer } from "./StorytellerWysiwygSyntaxDrawer";
import { StorytellerWysiwygTableMenu } from "./StorytellerWysiwygTableMenu";
import {
  truncateStorytellerSelectionPreview,
  type StorytellerSelectionAgentTrigger,
} from "./storytellerSelectionAgentTrigger";

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

const PLACEHOLDER_SX = {
  "& .wysiwyg-empty-paragraph::before": {
    content: "attr(data-placeholder)",
    float: "left",
    height: 0,
    color: "text.disabled",
    pointerEvents: "none",
    userSelect: "none",
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
  // 編輯區的段落是扁平陣列，沒有真的 <blockquote> 容器包住相鄰引用行（跟閱讀頁
  // StorytellerWysiwygMarkdown.tsx 的 BLOCK_GROUP_SX 不一樣，那邊是真的巢狀渲染，
  // 見上面的檔案說明）。HEADING_TYPOGRAPHY_SX 給每個 <p> 都加了 0.5em 的
  // margin-bottom，相鄰引用行之間會被這個 margin 撐出間隙，讓左側邊框斷成一截一截，
  // 而不是一條連續的引用線。用 negative margin-top + 等量 padding-top 把下一行的
  // 邊框「拉」上去補滿間隙，文字位置不受影響（padding 抵銷 margin），只是視覺上讓
  // 連續引用行的邊框看起來連在一起。
  "& [data-block-kind='quote'] + [data-block-kind='quote']": {
    marginTop: "-0.5em",
    paddingTop: "0.5em",
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
  // 真表格（Phase 5）：storytellerTable/tableRow/tableCell render 成真正的
  // <table><tr><td>（見 wysiwygCore/storytellerTable.ts），但原本沒有任何邊框樣式，
  // 使用者插入表格後完全看不出表格範圍在哪。跟閱讀頁 StorytellerWysiwygMarkdown.tsx
  // 的 BLOCK_GROUP_SX 用同一套邊框樣式，讓編輯區跟閱讀頁視覺一致。
  //
  // 已知 Bug 記錄第 19 項／Phase G 項目 7：table 外面現在包了一層
  // .storyteller-table-wrapper（見 storytellerTable.ts 的 addNodeView），用來放
  // 「選取整張表格」的 grip handle。原本 table 自己的 margin 搬到 wrapper 上
  // （wrapper 才是現在的最外層區塊），table 本身的 margin 歸零避免疊加。
  "& .storyteller-table-wrapper": {
    position: "relative",
    margin: "0.5em 0",
  },
  "& .storyteller-table-grip": {
    position: "absolute",
    top: -12,
    left: -12,
    width: 22,
    height: 22,
    padding: 0,
    lineHeight: 0,
    border: "1px solid",
    borderColor: "divider",
    borderRadius: "6px",
    bgcolor: "background.paper",
    cursor: "pointer",
    // 平常隱藏，hover 表格或選到表格時才出現——跟圖片節點常駐顯示的設定/刪除
    // 按鈕不同，表格這裡希望預設乾淨，不要每張表格都掛一顆按鈕。
    opacity: 0,
    transition: "opacity 0.15s ease, border-color 0.15s ease",
    zIndex: 1,
    "&:hover": { borderColor: "primary.main" },
  },
  "& .storyteller-table-wrapper:hover .storyteller-table-grip": {
    opacity: 1,
  },
  // ProseMirror 選到節點時，class 會直接加在 NodeView 回傳的 dom（也就是這個
  // wrapper）上——跟圖片節點的選取樣式用同一組 selection token，形成一致的
  // 「選到了」視覺語言，不用另外發明一套顏色。
  "& .storyteller-table-wrapper.ProseMirror-selectednode": {
    outline: "3px solid var(--storyteller-selection, #e6bd76)",
    outlineOffset: 3,
    borderRadius: "6px",
  },
  "& .storyteller-table-wrapper.ProseMirror-selectednode .storyteller-table-grip":
    {
      opacity: 1,
      borderColor: "var(--storyteller-selection, #e6bd76)",
    },
  "& table": {
    margin: 0,
    borderCollapse: "collapse",
    width: "100%",
    // Phase 8.1.4 階段一：原本沒設定 table-layout，瀏覽器預設用 auto，會即時依
    // 每個 cell 目前實際內容寬度重新計算欄寬——中文組字過程中每個候選字階段的
    // 寬度都不同，欄寬就跟著抖動（已知 Bug 記錄第 6 項）。改成 fixed 後，欄寬只
    // 在沒有任何欄寬資訊時才由瀏覽器依「第一列」cell 數平均分配一次，之後內容
    // 增減只在同一個欄寬內 wrap，不會再重新計算整欄寬度。這是穩定/防抖動用的
    // 最小改動，還沒做到使用者可以手動調欄寬（那是階段二，見 Phase 8.1.4）。
    tableLayout: "fixed",
  },
  "& td": {
    border: "1px solid",
    borderColor: "divider",
    padding: "6px 10px",
    minWidth: "2em",
    verticalAlign: "top",
    // table-layout:fixed 之後，cell 寬度不會再依內容撐開，長字串/長網址需要明講
    // 才會正確換行，不然會撐破欄寬。
    wordBreak: "break-word",
  },
  // Phase E：`@tiptap/pm/tables` 的 `tableEditing()` 在使用者用 Shift+方向鍵／
  // 拖曳跨 cell 選取多個儲存格時，會自動幫選到的 `<td>` 加上 `.selectedCell`
  // class（跟 decoration 機制本身沒問題，用 `document.querySelectorAll` 驗證過
  // class 確實會出現）——但這個 class 全站完全沒有對應的 CSS，選取範圍在畫面上
  // 一片空白，使用者完全看不出來選了哪些 cell，多選狀態下按 Backspace／套格式
  // 因此無法預期會發生什麼事。跟圖片/表格的 NodeSelection 用同一組 selection
  // token，統一「選到了」的視覺語言。
  "& td.selectedCell": {
    position: "relative",
    "&::after": {
      content: '""',
      position: "absolute",
      inset: 0,
      backgroundColor: "var(--storyteller-selection, #e6bd76)",
      opacity: 0.25,
      pointerEvents: "none",
    },
  },
} as const;

/** 觸控裝置（手指是主要輸入方式）的長按本身就會觸發原生 contextmenu 事件——這是
 * 使用者長按開始選字的手勢，不是想叫出選單。真機實測（Phase 9.4）發現我們的
 * `handleEditorContextMenu` 不分裝置一律搶下這個事件、還會把選取範圍收合成單點，
 * 導致長按選字整個失敗。用 `pointer: coarse` 判斷主要輸入是不是觸控（跟滑鼠精準
 * 指標的裝置分開），不是用螢幕寬度斷點——寬度斷點測的是「螢幕多寬」，這裡真正要
 * 分辨的是「使用者用什麼方式操作」，桌面瀏覽器把視窗縮到很窄仍然是滑鼠右鍵。 */
function isTouchPrimaryDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

export interface StorytellerWysiwygEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  /** 塞在文件層級 action 區的額外操作（例如 AI Agent／編輯歷史切換按鈕），不提供就不顯示。 */
  toolbarExtra?: ReactNode;
  /** 資產 node 用來查詢同專案 preview URL；不提供時只會顯示 asset id 佔位。 */
  projectPublicId?: string;
  /**
   * 匯出檔名的基底（通常是故事/設定集標題，編輯器自己不知道標題，由頁面層提供）。
   * 有提供才會在文件層級 action 區顯示「匯出 markdown」按鈕；實際檔名是
   * `[標題]_[timestamp].md`（見 buildExportFileName），timestamp 在按下當下才產生。
   * 匯出內容是把自訂白名單語法轉成標準 markdown（見 exportMarkdown.ts 的轉換規則），
   * 不是原始 content——原始格式含內部 marker 語法，不該外洩。
   */
  exportBaseName?: string;
  /**
   * 白名單：只列出的功能才會啟用，不提供（undefined）就全部啟用——維持既有頁面
   * （StoryEditor／LoreEditor）行為不變。目前支援腳注／註解／資產圖片開關，其餘編輯器
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
  /** 已存檔的故事/設定集才有 targetPublicId 可以呼叫 AI skill；未存檔時右鍵選單不顯示 AI 項目。 */
  hasSavedTarget?: boolean;
  onSelectionAgentTrigger?: (trigger: StorytellerSelectionAgentTrigger) => void;
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
    hasSavedTarget = false,
    onSelectionAgentTrigger,
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
  const [selectionAgentDialogTarget, setSelectionAgentDialogTarget] = useState<
    (StorytellerSelectionAgentDialogItem & { selectedText: string }) | null
  >(null);
  const [selectionAgentInstruction, setSelectionAgentInstruction] =
    useState("");
  // 額外需求 Dialog 的輸入框：不用 TextField autoFocus，改手動 focus({ preventScroll: true })，
  // 避免 MUI FocusTrap 的 .focus() 把編輯區 overflow:auto 容器捲回 scrollTop=0。
  const selectionAgentInputRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);
  const isComposingRef = useRef(false);
  const latestValueRef = useRef(value);
  const slashCommandContextRef = useRef<WysiwygCommandContext | null>(null);
  latestValueRef.current = value;

  const editor = useEditor({
    extensions: createWysiwygCoreExtensions({
      slashCommand: {
        getCommandContext: () => slashCommandContextRef.current,
      },
    }),
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
          hasComment: false,
          hasSelection: false,
          isCurrentParagraphEmpty: true,
          hasLink: false,
          hasFootnote: false,
          hasAssetImage: false,
        };
      }
      return {
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
        hasLink: ctx.editor.isActive("link"),
        hasFootnote: ctx.editor.isActive("footnote"),
        hasAssetImage: hasAssetImageLayoutTarget(ctx.editor),
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
    // 觸控裝置直接放行，不搶這個事件、不動選取範圍——讓原生長按選字／系統選單接手，
    // 格式化改靠已經驗證過的 bubble menu（選字後自動跳出）跟 slash 選單（空段落插入
    // 區塊），這兩個入口本來就涵蓋右鍵選單能做的事，不需要另外做行動版工具列。
    if (isTouchPrimaryDevice()) return;
    event.preventDefault();
    const result = editor.view.posAtCoords({
      left: event.clientX,
      top: event.clientY,
    });
    if (!result) return;
    const { from, to } = editor.state.selection;
    const clickedInsideSelection = result.pos >= from && result.pos <= to;
    if (!clickedInsideSelection) {
      const clickedAssetImage = (event.target as HTMLElement).closest(
        "[data-asset-layout]",
      );
      if (clickedAssetImage) {
        const state = editor.view.state;
        const pos = [result.inside, result.pos, result.pos - 1].find(
          (candidate) =>
            candidate >= 0 &&
            state.doc.nodeAt(candidate)?.type.name === "assetImage",
        );
        if (pos !== undefined) {
          editor.view.dispatch(
            state.tr.setSelection(NodeSelection.create(state.doc, pos)),
          );
        } else {
          editor.commands.setTextSelection(result.pos);
        }
      } else {
        editor.commands.setTextSelection(result.pos);
      }
    }
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
  };

  const closeContextMenu = () => setContextMenuPosition(null);

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

  const handleRequestSelectionAgentDialog = (
    item: StorytellerSelectionAgentDialogItem,
  ) => {
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, "\n");
    if (selectedText.trim() === "") {
      return;
    }
    setSelectionAgentInstruction("");
    setSelectionAgentDialogTarget({ ...item, selectedText });
  };

  const closeSelectionAgentDialog = () => {
    setSelectionAgentDialogTarget(null);
    setSelectionAgentInstruction("");
  };

  const submitSelectionAgentDialog = () => {
    if (!selectionAgentDialogTarget) {
      return;
    }
    onSelectionAgentTrigger?.({
      mode: selectionAgentDialogTarget.mode,
      selectedText: selectionAgentDialogTarget.selectedText,
      instruction: selectionAgentInstruction.trim(),
    });
    closeSelectionAgentDialog();
  };

  // Command Registry（wysiwygCore/commands.ts）共用的執行環境：右鍵選單、slash、
  // Bubble Menu、文件 action 區都靠同一份 context 呼叫 command.run。dialog 開關動作
  // （連結／腳注／註解）本來就是這個元件自己的 useState，command 只是呼叫既有 handler。
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
  slashCommandContextRef.current = commandContext;

  const utilityCommands = wysiwygCommandsByGroup("utility").filter(
    (command) => command.isVisible?.(commandContext) ?? true,
  );

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Paper
          variant="outlined"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 0.5,
            px: 0.75,
            py: 0.5,
            bgcolor: "background.paper",
          }}
        >
          <StorytellerWysiwygSyntaxDrawer enabledFeatures={enabledFeatures} />
          {utilityCommands.map((command) => {
            const Icon = command.icon!;
            return (
              <Tooltip key={command.id} title={command.label}>
                <IconButton
                  aria-label={command.label}
                  size="small"
                  onClick={() => command.run(editor, commandContext)}
                >
                  <Icon fontSize="small" />
                </IconButton>
              </Tooltip>
            );
          })}
          {toolbarExtra && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {toolbarExtra}
              </Box>
            </>
          )}
        </Paper>
      </Box>

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          // 原本桌面版固定 560px，視窗越高、下方留白越多（Faryne 實測反映）。
          // 改用視窗高度扣掉上方 header/工具列/頁面留白的估計值，讓編輯區跟著
          // 視窗變高變矮；手機版維持固定 420px（小螢幕高度本來就不夠，用
          // calc 反而容易算出過小或負值）。
          height: { xs: 420, md: "calc(100vh - 320px)" },
          minHeight: { md: 420 },
          overflow: "auto",
        }}
      >
        <Box
          sx={[
            HEADING_TYPOGRAPHY_SX,
            COMMENT_HIGHLIGHT_SX,
            INLINE_COLOR_SX,
            FOOTNOTE_HIGHLIGHT_SX,
            PLACEHOLDER_SX,
            BLOCK_KIND_SX,
            CLEAR_FLOATING_ASSET_SX,
          ]}
          onMouseOver={handleEditorMouseOver}
          onMouseOut={handleEditorMouseOut}
          onContextMenu={handleEditorContextMenu}
        >
          <EditorContent editor={editor} />
          <StorytellerWysiwygBubbleMenu
            editor={editor}
            commandContext={commandContext}
            hasSavedTarget={hasSavedTarget}
            onRequestSelectionAgentDialog={handleRequestSelectionAgentDialog}
          />
          <StorytellerWysiwygTableMenu editor={editor} />
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
        hasSavedTarget={hasSavedTarget}
        isCurrentParagraphEmpty={editorState.isCurrentParagraphEmpty}
        hasAssetImage={editorState.hasAssetImage}
        onRequestSelectionAgentDialog={handleRequestSelectionAgentDialog}
      />

      <Dialog
        open={selectionAgentDialogTarget !== null}
        onClose={closeSelectionAgentDialog}
        fullWidth
        maxWidth="sm"
        disableScrollLock
        disableAutoFocus
        disableRestoreFocus
        // disableAutoFocus 讓 FocusTrap 不要自己對第一個 tabbable 呼叫沒帶
        // preventScroll 的 focus()（那就是編輯區被捲回頂端的根因）；改成等
        // Dialog 的進場動畫真的跑完（onEntered，不是猜一個 requestAnimationFrame
        // 的時機）才手動用 preventScroll 補回焦點，這樣文字框還是會自動取得
        // 游標，只是不會動到編輯區的捲動位置。disableRestoreFocus 則是對稱的
        // 另一半：Dialog 關閉時 FocusTrap 預設會把焦點還給「開啟前 focus 的
        // 那個元素」，一樣是不帶 preventScroll 的 focus()，同一個根因在關閉
        // 時又會發作一次（送出/取消都會關閉 Dialog），關掉這個還原行為即可。
        TransitionProps={{
          onEntered: () => {
            selectionAgentInputRef.current?.focus({ preventScroll: true });
          },
        }}
      >
        <DialogTitle>
          {selectionAgentDialogTarget?.label ?? "AI 指令"}
        </DialogTitle>
        <DialogContent>
          {selectionAgentDialogTarget && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {selectionAgentDialogTarget.usage}
                您也可以在下方輸入額外需求，進一步指定想要的方向。
              </Typography>
              <Box
                sx={{
                  mb: 2,
                  pl: 1.5,
                  py: 0.75,
                  borderLeft: "3px solid",
                  borderColor: "divider",
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  {truncateStorytellerSelectionPreview(
                    selectionAgentDialogTarget.selectedText,
                  )}
                </Typography>
              </Box>
            </>
          )}
          <TextField
            inputRef={selectionAgentInputRef}
            fullWidth
            multiline
            minRows={3}
            label="額外需求（可留空）"
            value={selectionAgentInstruction}
            onChange={(event) =>
              setSelectionAgentInstruction(event.target.value)
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSelectionAgentDialog}>取消</Button>
          <Button variant="contained" onClick={submitSelectionAgentDialog}>
            套用到 AI 助理
          </Button>
        </DialogActions>
      </Dialog>

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
              {/* 觸控/鍵盤操作者沒有右鍵，右鍵不是唯一入口（見已知 Bug 記錄第 9
                  項：觸控裝置的右鍵事件已放行給原生長按選字，不會跳出我們的
                  選單）——選取文字後叫出的格式列（bubble menu）「加註解」按鈕
                  在選到既有註解時會變成「編輯註解」，對話框裡也有「移除註解」
                  按鈕，不寫死成「右鍵」這一種說法。 */}
              右鍵，或選取文字後用格式列可編輯／移除註解
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
              右鍵，或選取文字後用格式列可編輯／移除腳注
            </Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
});
