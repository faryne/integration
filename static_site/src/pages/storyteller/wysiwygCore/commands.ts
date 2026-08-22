import type { Editor } from "@tiptap/core";
import AddCommentIcon from "@mui/icons-material/AddComment";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import DeleteIcon from "@mui/icons-material/Delete";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FormatAlignCenterIcon from "@mui/icons-material/FormatAlignCenter";
import FormatAlignLeftIcon from "@mui/icons-material/FormatAlignLeft";
import FormatAlignRightIcon from "@mui/icons-material/FormatAlignRight";
import FormatBoldIcon from "@mui/icons-material/FormatBold";
import FormatItalicIcon from "@mui/icons-material/FormatItalic";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import FormatStrikethroughIcon from "@mui/icons-material/FormatStrikethrough";
import FormatUnderlinedIcon from "@mui/icons-material/FormatUnderlined";
import HorizontalRuleIcon from "@mui/icons-material/HorizontalRule";
import LinkIcon from "@mui/icons-material/Link";
import NoteAltIcon from "@mui/icons-material/NoteAlt";
import SubscriptIcon from "@mui/icons-material/Subscript";
import SuperscriptIcon from "@mui/icons-material/Superscript";
import TableChartIcon from "@mui/icons-material/TableChart";
import TitleIcon from "@mui/icons-material/Title";
import { NodeSelection } from "@tiptap/pm/state";
import type { ComponentType } from "react";

import { BG_COLOR_CSS, BG_COLOR_LABELS, TEXT_COLOR_CSS, TEXT_COLOR_LABELS } from "./colorStyles";
import { ASSET_IMAGE_LAYOUT_LABELS } from "./assetImageLayout";
import {
  ASSET_IMAGE_LAYOUT_VALUES,
  BG_COLOR_VALUES,
  DEFAULT_BLOCK_KIND,
  DEFAULT_HEADING_LEVEL,
  HEADING_LEVELS,
  normalizeAssetImageLayout,
  TEXT_COLOR_VALUES,
  type AssetImageLayoutValue,
  type BlockKindValue,
} from "./whitelist";

/**
 * Command Registry：工具列／右鍵選單（Phase 2）／slash command（Phase 3）／bubble menu
 * （Phase 4）共用同一份動作定義，避免同一個功能在四個入口各寫一次 `onClick`。
 *
 * 這是 Phase 1 的核心產出，Phase 2–4 只需要「消費」這份清單、決定要在自己的入口顯示
 * 哪些 command、用什麼 UI 呈現，不用重新定義動作本身。
 */

export type WysiwygCommandGroup =
  | "heading"
  | "mark"
  | "align"
  | "block"
  | "color"
  | "annotation"
  | "insert"
  | "image-layout"
  | "utility";

/**
 * 「沒有選取文字」時要顯示的區塊操作分組，依顯示順序排列——右鍵選單的「無選取」
 * 分支跟 slash 選單都直接引用這份清單，不再各自維護一份。以前 slash 選單另外
 * 寫死一份 `SLASH_COMMAND_GROUPS`，右鍵選單則是在 JSX 裡手動一個個列出
 * `wysiwygCommandsByGroup("heading")`／`wysiwygCommandsByGroup("align")`／
 * `wysiwygCommandsByGroup("block")`——新增 `align` group 時只改到右鍵選單那份，
 * slash 選單完全沒同步更新，兩邊悄悄長出落差（見已知 Bug 記錄）。改成兩邊都讀
 * 同一份陣列後，之後不管是新增 group 還是調整順序，只要改這裡一個地方。
 */
export const BLOCK_OPERATION_GROUPS: WysiwygCommandGroup[] = [
  "heading",
  "align",
  "block",
];

const SLASH_COMMAND_GROUPS: WysiwygCommandGroup[] = [
  ...BLOCK_OPERATION_GROUPS,
  "insert",
];

/**
 * 比原本三份分析文件寫的 `inline|block|insert` 多一個 `action`——這裡指「不改變文件
 * 內容本身、只是觸發一個副作用」的動作（目前只有匯出 markdown），塞進 inline/block/
 * insert 都不準確，硬塞會誤導未來讀這份 registry 的人以為它會動到編輯器內容。
 */
export type WysiwygCommandScope = "inline" | "block" | "insert" | "action";

export interface WysiwygCommandContext {
  isFeatureEnabled: (feature: "footnote" | "comment" | "asset") => boolean;
  /** 只有頁面層有提供 `exportBaseName` 時匯出功能才存在，跟 footnote/comment 一樣是可見性開關。 */
  canExportMarkdown: boolean;
  /** 只有頁面層有提供 `onRequestInsertAsset` 且資產功能開啟時，插入圖片才存在——
   * asset picker 是頁面層的 state（StoryEditor／LoreEditor 各自的 Dialog），
   * command 本身不持有這個 state，只透過這個 callback 觸發它開啟。 */
  canInsertAsset: boolean;
  openLinkDialog: () => void;
  openFootnoteDialog: () => void;
  openCommentDialog: () => void;
  openAssetPicker: () => void;
  exportMarkdown: () => void;
}

export interface WysiwygCommand {
  id: string;
  label: string;
  /** 目前生效時要顯示的替代文字（例如「加連結」→「編輯連結」），沒有就一直顯示 label。 */
  activeLabel?: string;
  group: WysiwygCommandGroup;
  scope: WysiwygCommandScope;
  icon?: ComponentType<{ fontSize?: "small" }>;
  /** 顏色類 command 用色塊而不是 icon 呈現，見 COLOR_COMMANDS。 */
  previewColor?: string;
  /** 中英文別名，Phase 3 slash command 要用；Phase 1 只需要先把資料備好。 */
  aliases?: string[];
  /** 目前是否處於生效狀態（工具列/右鍵選單的高亮判斷），未定義代表這個 command 不需要高亮。 */
  isActive?: (editor: Editor) => boolean;
  /** 目前能不能執行（disabled 判斷），未定義代表永遠可執行。 */
  isEnabled?: (editor: Editor, context: WysiwygCommandContext) => boolean;
  /** 這個 command 在目前設定下該不該出現（feature flag／exportBaseName 開關），未定義代表永遠顯示。 */
  isVisible?: (context: WysiwygCommandContext) => boolean;
  run: (editor: Editor, context: WysiwygCommandContext) => void;
}

const MARK_COMMANDS: WysiwygCommand[] = [
  {
    id: "bold",
    label: "粗體",
    group: "mark",
    scope: "inline",
    icon: FormatBoldIcon,
    aliases: ["粗體", "bold"],
    isActive: (editor) => editor.isActive("bold"),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: "italic",
    label: "斜體",
    group: "mark",
    scope: "inline",
    icon: FormatItalicIcon,
    aliases: ["斜體", "italic"],
    isActive: (editor) => editor.isActive("italic"),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: "underline",
    label: "底線",
    group: "mark",
    scope: "inline",
    icon: FormatUnderlinedIcon,
    aliases: ["底線", "underline"],
    isActive: (editor) => editor.isActive("underline"),
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    id: "subscript",
    label: "下標",
    group: "mark",
    scope: "inline",
    icon: SubscriptIcon,
    aliases: ["下標", "subscript"],
    isActive: (editor) => editor.isActive("subscript"),
    run: (editor) => editor.chain().focus().toggleSubscript().run(),
  },
  {
    id: "superscript",
    label: "上標",
    group: "mark",
    scope: "inline",
    icon: SuperscriptIcon,
    aliases: ["上標", "superscript"],
    isActive: (editor) => editor.isActive("superscript"),
    run: (editor) => editor.chain().focus().toggleSuperscript().run(),
  },
  {
    id: "strike",
    label: "刪除線",
    group: "mark",
    scope: "inline",
    icon: FormatStrikethroughIcon,
    aliases: ["刪除線", "strike", "strikethrough"],
    isActive: (editor) => editor.isActive("strike"),
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
];

/** 標題 0（內文）到 6，游標在空白段落／非空段落時的「區塊轉換」都是同一組 command
 * （Phase 2 右鍵選單新增的情境，工具列本來就有對應的標題 Select，只是那邊不走
 * command registry——Select 需要單一 value/onChange，不適合拆成多個獨立 toggle
 * command）。 */
const HEADING_COMMANDS: WysiwygCommand[] = [
  DEFAULT_HEADING_LEVEL,
  ...HEADING_LEVELS,
].map((level) => ({
  id: `heading-${level}`,
  label: level === DEFAULT_HEADING_LEVEL ? "內文" : `標題 ${level}`,
  group: "heading",
  scope: "block",
  icon: TitleIcon,
  aliases:
    level === DEFAULT_HEADING_LEVEL
      ? ["內文", "paragraph", "text"]
      : [
          `標題${level}`,
          `heading${level}`,
          `heading ${level}`,
          `title${level}`,
          `h${level}`,
        ],
  isActive: (editor) => editor.isActive("paragraph", { headingLevel: level }),
  run: (editor) => editor.chain().focus().setHeadingLevel(level).run(),
}));

const INSERT_COMMANDS: WysiwygCommand[] = [
  {
    id: "insert-table",
    label: "插入表格",
    group: "insert",
    scope: "insert",
    icon: TableChartIcon,
    aliases: ["表格", "table", "/table"],
    run: (editor) =>
      editor.chain().focus().insertStorytellerTable({ rows: 3, cols: 3 }).run(),
  },
  {
    id: "insert-image",
    label: "插入圖片",
    group: "insert",
    scope: "insert",
    icon: AddPhotoAlternateIcon,
    aliases: ["圖片", "image", "插入資產"],
    isVisible: (context) => context.canInsertAsset,
    run: (_editor, context) => context.openAssetPicker(),
  },
];

export function findAssetImageAtSelection(editor: Editor) {
  const { selection } = editor.state;
  if (
    selection instanceof NodeSelection &&
    selection.node.type.name === "assetImage"
  ) {
    return { pos: selection.from, node: selection.node };
  }
  const { $from } = selection;
  const parentStart = $from.start();
  const before = $from.parent.childBefore($from.parentOffset);
  if (before.node?.type.name === "assetImage") {
    return { pos: parentStart + before.offset, node: before.node };
  }
  const after = $from.parent.childAfter($from.parentOffset);
  if (after.node?.type.name === "assetImage") {
    return { pos: parentStart + after.offset, node: after.node };
  }
  return null;
}

export function hasAssetImageLayoutTarget(editor: Editor) {
  return findAssetImageAtSelection(editor) !== null;
}

function setAssetImageLayout(
  editor: Editor,
  layout: AssetImageLayoutValue,
) {
  editor
    .chain()
    .focus()
    .command(({ state, dispatch }) => {
      const target = findAssetImageAtSelection(editor);
      if (!target) return false;
      if (dispatch) {
        dispatch(
          state.tr.setNodeMarkup(target.pos, undefined, {
            ...target.node.attrs,
            layout,
          }),
        );
      }
      return true;
    })
    .run();
}

const IMAGE_LAYOUT_ICONS: Record<
  AssetImageLayoutValue,
  ComponentType<{ fontSize?: "small" }>
> = {
  block: AddPhotoAlternateIcon,
  center: FormatAlignCenterIcon,
  "float-left": FormatAlignLeftIcon,
  "float-right": FormatAlignRightIcon,
};

const IMAGE_LAYOUT_COMMANDS: WysiwygCommand[] = ASSET_IMAGE_LAYOUT_VALUES.map(
  (layout) => ({
    id: `image-layout-${layout}`,
    label: ASSET_IMAGE_LAYOUT_LABELS[layout],
    group: "image-layout",
    scope: "block",
    icon: IMAGE_LAYOUT_ICONS[layout],
    isActive: (editor) => {
      const target = findAssetImageAtSelection(editor);
      return (
        normalizeAssetImageLayout(target?.node.attrs.layout) === layout &&
        target !== null
      );
    },
    isEnabled: (editor) => hasAssetImageLayoutTarget(editor),
    run: (editor) => setAssetImageLayout(editor, layout),
  }),
);

const ALIGN_LABELS = { left: "置左", center: "置中", right: "置右" } as const;
const ALIGN_ICONS = {
  left: FormatAlignLeftIcon,
  center: FormatAlignCenterIcon,
  right: FormatAlignRightIcon,
} as const;

const ALIGN_COMMANDS: WysiwygCommand[] = (
  ["left", "center", "right"] as const
).map((value) => ({
  id: `align-${value}`,
  label: ALIGN_LABELS[value],
  group: "align",
  scope: "block",
  icon: ALIGN_ICONS[value],
  isActive: (editor: Editor) => editor.isActive({ textAlign: value }),
  run: (editor: Editor) =>
    editor.chain().focus().setTextAlign(value).run(),
}));

/** 引用/清單是「切換目前段落種類」，再按一次會切回一般段落——跟原本
 * toggleBlockKind 邏輯一致，只是內聯進各自的 command。 */
function toggleBlockKindCommand(
  kind: Exclude<BlockKindValue, "none">,
  label: string,
  icon: ComponentType<{ fontSize?: "small" }>,
  aliases: string[],
): WysiwygCommand {
  return {
    id: `block-kind-${kind}`,
    label,
    group: "block",
    scope: "block",
    icon,
    aliases,
    isActive: (editor) => editor.isActive("paragraph", { blockKind: kind }),
    run: (editor) => {
      const next = editor.isActive("paragraph", { blockKind: kind })
        ? DEFAULT_BLOCK_KIND
        : kind;
      editor.chain().focus().setBlockKind(next).run();
    },
  };
}

const BLOCK_KIND_COMMANDS: WysiwygCommand[] = [
  toggleBlockKindCommand("quote", "引用", FormatQuoteIcon, [
    "引用",
    "quote",
    "blockquote",
  ]),
  toggleBlockKindCommand("bullet", "無序清單", FormatListBulletedIcon, [
    "無序清單",
    "項目清單",
    "bullet",
    "bulleted list",
    "list",
    "ul",
  ]),
  toggleBlockKindCommand("number", "有序清單", FormatListNumberedIcon, [
    "有序清單",
    "編號清單",
    "number",
    "numbered list",
    "ordered list",
    "ol",
  ]),
  {
    id: "horizontal-rule",
    label: "插入分隔線",
    group: "block",
    scope: "insert",
    icon: HorizontalRuleIcon,
    aliases: ["分隔線", "horizontal rule", "hr"],
    run: (editor) => editor.chain().focus().insertHorizontalRule().run(),
  },
];

const COLOR_COMMANDS: WysiwygCommand[] = [
  ...TEXT_COLOR_VALUES.map(
    (color): WysiwygCommand => ({
      id: `text-color-${color}`,
      label: TEXT_COLOR_LABELS[color],
      group: "color",
      scope: "inline",
      previewColor: TEXT_COLOR_CSS[color],
      isActive: (editor) => editor.isActive("textColor", { value: color }),
      run: (editor) => editor.chain().focus().setTextColor(color).run(),
    }),
  ),
  {
    id: "text-color-clear",
    label: "清除文字顏色",
    group: "color",
    scope: "inline",
    icon: DeleteIcon,
    run: (editor) => editor.chain().focus().unsetTextColor().run(),
  },
  ...BG_COLOR_VALUES.map(
    (color): WysiwygCommand => ({
      id: `bg-color-${color}`,
      label: BG_COLOR_LABELS[color],
      group: "color",
      scope: "inline",
      previewColor: BG_COLOR_CSS[color],
      isActive: (editor) => editor.isActive("bgColor", { value: color }),
      run: (editor) => editor.chain().focus().setBgColor(color).run(),
    }),
  ),
  {
    id: "bg-color-clear",
    label: "清除背景色",
    group: "color",
    scope: "inline",
    icon: DeleteIcon,
    run: (editor) => editor.chain().focus().unsetBgColor().run(),
  },
];

const ANNOTATION_COMMANDS: WysiwygCommand[] = [
  {
    id: "link",
    label: "加連結",
    activeLabel: "編輯連結",
    group: "annotation",
    scope: "inline",
    icon: LinkIcon,
    aliases: ["連結", "link"],
    isActive: (editor) => editor.isActive("link"),
    run: (_editor, context) => context.openLinkDialog(),
  },
  {
    id: "footnote",
    label: "加腳注",
    activeLabel: "編輯腳注",
    group: "annotation",
    scope: "inline",
    icon: NoteAltIcon,
    aliases: ["腳注", "footnote"],
    isActive: (editor) => editor.isActive("footnote"),
    isVisible: (context) => context.isFeatureEnabled("footnote"),
    run: (_editor, context) => context.openFootnoteDialog(),
  },
  {
    id: "comment",
    label: "加註解",
    activeLabel: "編輯註解",
    group: "annotation",
    scope: "inline",
    icon: AddCommentIcon,
    aliases: ["註解", "comment"],
    isActive: (editor) => editor.isActive("comment"),
    // 註解是行內 marker，套用在「一段選取的文字」上：只有真的選了文字，或游標已經
    // 落在既有註解裡（此時是要編輯/移除，不是新增）才能開，比照原本 canOpenCommentDialog。
    isEnabled: (editor) =>
      editor.isActive("comment") || !editor.state.selection.empty,
    isVisible: (context) => context.isFeatureEnabled("comment"),
    run: (_editor, context) => context.openCommentDialog(),
  },
];

const UTILITY_COMMANDS: WysiwygCommand[] = [
  {
    id: "export-markdown",
    label: "匯出 markdown 檔案",
    group: "utility",
    scope: "action",
    icon: FileDownloadIcon,
    isVisible: (context) => context.canExportMarkdown,
    run: (_editor, context) => context.exportMarkdown(),
  },
];

export const WYSIWYG_COMMANDS: WysiwygCommand[] = [
  ...HEADING_COMMANDS,
  ...MARK_COMMANDS,
  ...ALIGN_COMMANDS,
  ...BLOCK_KIND_COMMANDS,
  ...COLOR_COMMANDS,
  ...ANNOTATION_COMMANDS,
  ...INSERT_COMMANDS,
  ...IMAGE_LAYOUT_COMMANDS,
  ...UTILITY_COMMANDS,
];

export function getWysiwygCommand(id: string): WysiwygCommand | undefined {
  return WYSIWYG_COMMANDS.find((command) => command.id === id);
}

export function wysiwygCommandsByGroup(
  group: WysiwygCommandGroup,
): WysiwygCommand[] {
  return WYSIWYG_COMMANDS.filter((command) => command.group === group);
}

/** 給右鍵選單／slash command 用的可見清單：套用 `isVisible`，過濾掉目前設定下不該顯示的 command。 */
export function visibleWysiwygCommands(
  group: WysiwygCommandGroup,
  context: WysiwygCommandContext,
): WysiwygCommand[] {
  return wysiwygCommandsByGroup(group).filter(
    (command) => command.isVisible?.(context) ?? true,
  );
}

function normalizeSlashQuery(value: string) {
  return value
    .trim()
    .replace(/^\/+/, "")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

function slashCommandSearchValues(command: WysiwygCommand) {
  return [command.label, command.id, ...(command.aliases ?? [])].map((value) =>
    normalizeSlashQuery(value),
  );
}

/** Slash menu 只提供空區塊可用的 block/insert 類動作；完整行內樣式仍交給 bubble/context menu。 */
export function slashWysiwygCommands(
  query: string,
  editor: Editor,
  context: WysiwygCommandContext,
): WysiwygCommand[] {
  const normalizedQuery = normalizeSlashQuery(query);
  return SLASH_COMMAND_GROUPS.flatMap((group) =>
    visibleWysiwygCommands(group, context),
  ).filter((command) => {
    if (command.isEnabled && !command.isEnabled(editor, context)) return false;
    if (normalizedQuery === "") return true;
    return slashCommandSearchValues(command).some((value) =>
      value.includes(normalizedQuery),
    );
  });
}
