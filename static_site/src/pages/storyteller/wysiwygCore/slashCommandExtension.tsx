import { Extension, type Editor, type Range } from "@tiptap/core";
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { PluginKey, type EditorState } from "@tiptap/pm/state";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  slashWysiwygCommands,
  type WysiwygCommand,
  type WysiwygCommandContext,
} from "./commands";

export const slashCommandPluginKey = new PluginKey("storytellerSlashCommand");

interface SlashCommandExtensionOptions {
  getCommandContext?: () => WysiwygCommandContext | null;
  maxItems?: number;
}

type SlashSuggestionProps = SuggestionProps<WysiwygCommand, WysiwygCommand>;
type SlashCommandKey = "ArrowDown" | "ArrowUp" | "Enter" | "Escape";

const activeSlashCommandControllers = new WeakMap<
  Editor,
  { onKeyDown: (key: SlashCommandKey) => boolean }
>();

// ProseMirror `textBetween` 預設把非文字的 leaf node（例如 assetImage 這種
// atom）當成長度 0 的空字串，不會出現在回傳的文字裡——這代表「游標緊接在一張
// 圖片後面」在這裡看起來跟「段落真的是空的」一模一樣，會誤判成可以觸發 slash
// 選單。傳入 leafText 讓每個 atom 都貢獻一個不可能出現在使用者輸入裡的佔位字元
// （Unicode Object Replacement Character），這樣段落裡只要有圖片這類 atom，
// textBefore/textAfter 就不會再等於純文字判斷式預期的樣子，slash 選單改成正確
// 判斷「不是真的空段落」而不顯示。已知 Bug 記錄第 11 項：這個誤判是圖片後面
// 緊接著用 slash 插入分隔線會把圖片吃掉的根本原因（`insertHorizontalRule` 在
// 「以為段落只有 query 文字、其實還有圖片 atom」的情況下，把整個段落內容連同
// 圖片一起清空）。
const ATOM_PLACEHOLDER = "￼";

function isTextOnlySlashQuery(state: EditorState, range: Range) {
  const { selection } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;
  if ($from.parent.type.name !== "paragraph") return false;

  const textBefore = $from.parent.textBetween(
    0,
    $from.parentOffset,
    "",
    ATOM_PLACEHOLDER,
  );
  const textAfter = $from.parent.textBetween(
    $from.parentOffset,
    $from.parent.content.size,
    "",
    ATOM_PLACEHOLDER,
  );
  return (
    textBefore.startsWith("/") &&
    textAfter === "" &&
    range.from >= $from.start()
  );
}

export function canShowSlashCommand(state: EditorState, range: Range) {
  return isTextOnlySlashQuery(state, range);
}

export function runSlashCommand(
  editor: Editor,
  range: Range,
  command: WysiwygCommand,
  context: WysiwygCommandContext,
) {
  editor.chain().focus().deleteRange(range).run();
  command.run(editor, context);
}

/** 把 command 的 icon（跟工具列/右鍵選單共用同一個 ComponentType）渲染成靜態 SVG
 * markup，塞進純 DOM 按鈕裡——這個 renderer 是 Suggestion 的 imperative DOM
 * mount，不是 React tree，用 renderToStaticMarkup 是最小改動的接法。 */
function renderCommandIconMarkup(
  icon: ComponentType<{ fontSize?: "small" }> | undefined,
) {
  if (!icon) return null;
  return renderToStaticMarkup(createElement(icon, { fontSize: "small" }));
}

function renderSlashCommandItems(
  element: HTMLElement,
  props: SlashSuggestionProps,
  selectedIndex: number,
) {
  element.replaceChildren();
  props.items.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.commandId = item.id;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(index === selectedIndex));
    button.style.cssText = [
      "display:flex",
      "align-items:center",
      "gap:8px",
      "width:100%",
      "border:0",
      "background:transparent",
      "padding:6px 10px",
      "text-align:left",
      "font:inherit",
      // <button> 在部分瀏覽器的 UA 樣式會有自己的文字色（不像一般行內元素會自動
      // 繼承），這裡明講 inherit，才吃得到外層 element 設的 --storyteller-text-primary。
      "color:inherit",
      "cursor:pointer",
    ].join(";");
    if (index === selectedIndex) {
      // Phase C：改吃 Phase A 的 semantic token，跟右鍵選單 MenuItem 的
      // `.Mui-selected`（storytellerComponentOverrides.ts 裡也是 selection）
      // 用同一個顏色來源，不再各自對應不同的 CSS variable 命名空間。
      button.style.background = "var(--storyteller-selection, rgba(25, 118, 210, 0.12))";
    }

    const iconMarkup = renderCommandIconMarkup(item.icon);
    if (iconMarkup) {
      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = iconMarkup;
      iconSpan.style.cssText = [
        "display:inline-flex",
        "flex-shrink:0",
        "color:var(--storyteller-text-muted, rgba(0, 0, 0, 0.6))",
      ].join(";");
      button.appendChild(iconSpan);
    }

    const labelSpan = document.createElement("span");
    labelSpan.textContent = item.label;
    button.appendChild(labelSpan);

    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      props.command(item);
    });
    element.appendChild(button);
    // 選單本身會 overflow:auto 捲動（見 mount 裡的 max-height），純滑鼠操作時使用者
    // 自己捲得到，但鍵盤上下鍵切換 selectedIndex 只是重繪 background 高亮、不會讓
    // 捲軸跟著移動——沒有這行的話，選到清單底部的項目（例如插入表格/圖片）時，
    // 高亮的按鈕會被捲到看不見的地方，使用者只看得到上面沒被選到的項目。
    if (index === selectedIndex) {
      button.scrollIntoView({ block: "nearest" });
    }
  });
}

function createSlashCommandRenderer() {
  let element: HTMLElement | null = null;
  let unmount: (() => void) | null = null;
  let latestProps: SlashSuggestionProps | null = null;
  let selectedIndex = 0;

  function mount(props: SlashSuggestionProps) {
    element = document.createElement("div");
    element.setAttribute("role", "listbox");
    element.style.cssText = [
      "z-index:1500",
      "min-width:180px",
      "max-width:280px",
      "max-height:260px",
      "overflow:auto",
      "border:1px solid var(--storyteller-border-subtle, rgba(0, 0, 0, 0.12))",
      "border-radius:6px",
      // 這個選單是純手刻 DOM，不在 React tree 裡吃 MUI sx，原本顏色是寫死的
      // #fff／黑色系列，深色模式下會變成一塊突兀的白色方塊（已知 Bug 記錄第 7
      // 項）。先前暫用 MUI 自動產生的 var(--mui-palette-*)（cssVariables:
      // true 開的）過渡；Phase A 定案 semantic token 之後，這裡改吃
      // var(--storyteller-editor-menu) 等 `--storyteller-*` 變數，跟右鍵
      // 選單／Dialog／Bubble menu 用同一組 token 來源，不再各自對應不同
      // 命名空間。MUI 沒開這組 CSS variable 的頁面（例如 Playground）會
      // 退回 fallback 值，維持原本外觀。
      "background:var(--storyteller-editor-menu, #fff)",
      "color:var(--storyteller-text-primary, rgba(0, 0, 0, 0.87))",
      "box-shadow:0 6px 18px rgba(0, 0, 0, 0.18)",
      "padding:4px 0",
    ].join(";");
    selectedIndex = 0;
    latestProps = props;
    renderSlashCommandItems(element, props, selectedIndex);
    activeSlashCommandControllers.set(props.editor, controller);
    unmount = props.mount(element);
  }

  function update(props: SlashSuggestionProps) {
    if (!element) return;
    latestProps = props;
    selectedIndex = Math.min(selectedIndex, Math.max(0, props.items.length - 1));
    renderSlashCommandItems(element, props, selectedIndex);
  }

  const controller = {
    onKeyDown(key: SlashCommandKey) {
      if (!latestProps || latestProps.items.length === 0) return false;
      if (key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % latestProps.items.length;
        if (element) {
          renderSlashCommandItems(element, latestProps, selectedIndex);
        }
        return true;
      }
      if (key === "ArrowUp") {
        selectedIndex =
          (selectedIndex + latestProps.items.length - 1) %
          latestProps.items.length;
        if (element) {
          renderSlashCommandItems(element, latestProps, selectedIndex);
        }
        return true;
      }
      if (key === "Enter") {
        latestProps.command(latestProps.items[selectedIndex]);
        return true;
      }
      if (key === "Escape") {
        exitSuggestion(latestProps.editor.view, slashCommandPluginKey);
        return true;
      }
      return false;
    },
  };

  return {
    onStart: mount,
    onUpdate: update,
    onKeyDown: ({ event }: SuggestionKeyDownProps) =>
      controller.onKeyDown(event.key as SlashCommandKey),
    onExit() {
      unmount?.();
      element?.remove();
      if (latestProps) activeSlashCommandControllers.delete(latestProps.editor);
      element = null;
      unmount = null;
      latestProps = null;
      selectedIndex = 0;
    },
  };
}

export const SlashCommand = Extension.create<SlashCommandExtensionOptions>({
  name: "slashCommand",
  priority: 1000,

  addOptions() {
    return {
      getCommandContext: () => null,
      // 空白 `/` 沒有篩選字時，這個上限決定使用者第一眼能看到哪些功能——8 剛好會被
      // heading 群組（內文＋標題1~6，7 項）吃掉大半，導致表格／圖片等 insert 群組的
      // command 永遠露不出來（見選單本身已有 max-height + 捲動，見下方 render 裡的
      // 260px），所以拉高到能涵蓋目前 registry 全部 slash command（13 項）再留一點餘裕。
      maxItems: 20,
    };
  },

  addKeyboardShortcuts() {
    // IME 組字期間（候選字視窗開著）這幾個鍵可能是輸入法自己在用（例如注音候選字
    // 選字、取消組字），不是操作 slash 選單——使用者實測發現組字中按 Escape 會被
    // 我們搶先攔截，同時取消候選字「跟」關掉 slash 選單，但預期應該只取消候選字
    // （Phase 9.1 案例 2）。composing 時一律回傳 false，讓瀏覽器/輸入法先處理完，
    // 不要搶在 compositionend 之前動 slash 選單的狀態。
    const handleKey = (key: SlashCommandKey) => {
      if (this.editor.view.composing) return false;
      return activeSlashCommandControllers.get(this.editor)?.onKeyDown(key) ?? false;
    };
    return {
      ArrowDown: () => handleKey("ArrowDown"),
      ArrowUp: () => handleKey("ArrowUp"),
      Enter: () => handleKey("Enter"),
      Escape: () => handleKey("Escape"),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion<WysiwygCommand, WysiwygCommand>({
        editor: this.editor,
        pluginKey: slashCommandPluginKey,
        char: "/",
        allowedPrefixes: null,
        startOfLine: true,
        allow: ({ state, range }) => canShowSlashCommand(state, range),
        items: ({ editor, query }) => {
          const context = this.options.getCommandContext?.();
          if (!context) return [];
          return slashWysiwygCommands(query, editor, context).slice(
            0,
            this.options.maxItems,
          );
        },
        shouldShow: ({ editor, query }) => {
          const context = this.options.getCommandContext?.();
          return context
            ? slashWysiwygCommands(query, editor, context).length > 0
            : false;
        },
        command: ({ editor, range, props }) => {
          const context = this.options.getCommandContext?.();
          if (!context) return;
          runSlashCommand(editor, range, props, context);
        },
        render: createSlashCommandRenderer,
      }),
    ];
  },
});
