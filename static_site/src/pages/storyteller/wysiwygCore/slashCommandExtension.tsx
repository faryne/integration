import { Extension, type Editor } from "@tiptap/core";
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import { Box, Divider, Paper, Typography } from "@mui/material";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import {
  slashWysiwygCommands,
  type WysiwygCommand,
  type WysiwygCommandContext,
} from "./commands";
import {
  canShowSlashCommand,
  runSlashCommand,
  slashCommandPluginKey,
} from "./slashCommandCore";

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

interface SlashCommandListProps {
  items: WysiwygCommand[];
  selectedIndex: number;
  onSelect: (item: WysiwygCommand) => void;
  listboxId: string;
  getOptionId: (index: number) => string;
}

const SLASH_GROUP_LABELS: Partial<Record<WysiwygCommand["group"], string>> = {
  heading: "段落樣式",
  align: "對齊",
  block: "區塊",
  insert: "插入",
  ai: "AI 協作",
};

/** 選單本體改用真正的 React／MUI 元件（跟右鍵選單同一套 command → icon+label 呈現
 * 方式），透過 `ReactRenderer` 掛進 editor 自己的 React tree（見下方
 * `createSlashCommandRenderer`）——取代原本手刻 DOM + `renderToStaticMarkup` 的
 * 做法。原本的做法在 Playground 正常、但在真實登入頁面（`StorytellerLayout` 的
 * `ThemeProvider` 底下）icon 完全消失（已知 Bug 記錄第 8 項，未解決）；懷疑是
 * `renderToStaticMarkup` 在脫離正常 React tree 的情況下同步渲染 MUI icon 元件
 * 行為不同。`ReactRenderer` 是 Tiptap 官方建議的 suggestion popup 渲染方式，會把
 * 內容掛進 editor 所在的同一棵 React tree（透過 portal），不再脫離 context，
 * 順便讓 icon 渲染跟右鍵選單一樣是「真的 JSX」，不用另外維護一套字串拼接的
 * 手刻 DOM 邏輯。 */
function SlashCommandList({
  items,
  selectedIndex,
  onSelect,
  listboxId,
  getOptionId,
}: SlashCommandListProps) {
  const groups = items.reduce<
    Array<{
      group: WysiwygCommand["group"];
      items: Array<{ command: WysiwygCommand; index: number }>;
    }>
  >((result, command, index) => {
    const current = result[result.length - 1];
    if (current?.group === command.group) {
      current.items.push({ command, index });
    } else {
      result.push({ group: command.group, items: [{ command, index }] });
    }
    return result;
  }, []);

  return (
    <Paper
      elevation={4}
      role="listbox"
      aria-label="斜線指令選單"
      id={listboxId}
      sx={{
        // z-index 不能設在這裡：`Paper` 預設 `position:static`，CSS 規定
        // z-index 對 `position:static` 元素完全沒作用，設了也會被忽略。真正
        // 決定「會不會被其他區塊蓋住」的是外層 wrapper `<div>`（`props.mount()`
        // 掛載、`position:absolute` 的那個），z-index 要設在那裡，見下面
        // `createSlashCommandRenderer()` 的 `element.style.zIndex`。
        boxSizing: "border-box",
        width: "min(540px, calc(100vw - 24px))",
        maxHeight: "min(440px, calc(100vh - 24px))",
        overflow: "auto",
        bgcolor: "var(--storyteller-editor-menu, #fff)",
        color: "var(--storyteller-text-primary, rgba(0, 0, 0, 0.87))",
        py: 0.5,
      }}
    >
      {groups.map(({ group, items: groupItems }, groupIndex) => (
        <Box
          key={group}
          component="div"
          role="group"
          aria-label={SLASH_GROUP_LABELS[group]}
        >
          {groupIndex > 0 && (
            <Divider
              sx={{
                borderColor:
                  "var(--storyteller-border-subtle, rgba(0, 0, 0, 0.12))",
              }}
            />
          )}
          <Typography
            component="div"
            variant="caption"
            sx={{ px: 1, pt: 0.5, pb: 0.25, fontWeight: 700 }}
          >
            {SLASH_GROUP_LABELS[group]}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 0.25,
              px: 0.5,
              pb: 0.5,
              "@media (max-width: 600px)": {
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            {groupItems.map(({ command, index }) => {
              const Icon = command.icon;
              const selected = index === selectedIndex;
              return (
                <Box
                  key={command.id}
                  component="button"
                  type="button"
                  role="option"
                  id={getOptionId(index)}
                  aria-selected={selected}
                  data-command-id={command.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onSelect(command);
                  }}
                  // 鍵盤上下鍵仍依右鍵選單相同的 command 順序走；跨欄時也會把
                  // 目前高亮項目捲進可視範圍。
                  ref={(node: HTMLButtonElement | null) => {
                    if (selected) node?.scrollIntoView({ block: "nearest" });
                  }}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.75,
                    minWidth: 0,
                    minHeight: 34,
                    border: 0,
                    borderRadius: 1,
                    bgcolor: selected
                      ? "color-mix(in srgb, var(--storyteller-selection, #1976d2) 22%, transparent)"
                      : "transparent",
                    color: "inherit",
                    font: "inherit",
                    textAlign: "left",
                    px: 0.75,
                    py: 0.5,
                    cursor: "pointer",
                    "&:hover": {
                      bgcolor:
                        "color-mix(in srgb, var(--storyteller-selection, #1976d2) 14%, transparent)",
                    },
                  }}
                >
                  {Icon && (
                    <Box
                      component="span"
                      sx={{
                        display: "inline-flex",
                        flexShrink: 0,
                        color:
                          "var(--storyteller-text-muted, rgba(0, 0, 0, 0.6))",
                      }}
                    >
                      <Icon fontSize="small" />
                    </Box>
                  )}
                  <Box
                    component="span"
                    sx={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {command.label}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

let slashCommandListboxCounter = 0;

/** 真正的鍵盤 focus 全程留在 ProseMirror 的 contenteditable 上（打字、上下鍵都是
 * editor 自己處理，不會把 focus 移到選單的 DOM 節點），這是典型的「virtual focus」
 * 情境（跟 combobox/command palette 同一類）——螢幕閱讀器沒辦法從「focus 移動」
 * 知道使用者現在選到哪個選項，要靠 `aria-activedescendant` 明講。這裡直接在
 * `editor.view.dom`（真正持有 focus 的元素）上設 `aria-expanded`／`aria-controls`
 * （指到選單的 id）／`aria-activedescendant`（指到目前高亮選項的 id），選單關閉時
 * 全部清掉。 */
function setEditorSlashAriaState(
  editor: Editor,
  state: { listboxId: string; activeOptionId: string } | null,
) {
  const dom = editor.view.dom;
  if (!state) {
    dom.removeAttribute("aria-expanded");
    dom.removeAttribute("aria-controls");
    dom.removeAttribute("aria-activedescendant");
    return;
  }
  dom.setAttribute("aria-expanded", "true");
  dom.setAttribute("aria-controls", state.listboxId);
  dom.setAttribute("aria-activedescendant", state.activeOptionId);
}

function createSlashCommandRenderer() {
  // 用 `react-dom/client` 的 `createRoot` 直接掛一個獨立、自給自足的 React root，
  // 不透過 `@tiptap/react` 的 `ReactRenderer`。原因：`ReactRenderer` 內部靠
  // `editor.contentComponent?.setRenderer(...)` 把內容透過 portal 掛進
  // `EditorContent` 自己的 React tree，這個 `contentComponent` 是 `EditorContent`
  // 掛載時才會設好的內部狀態——如果因為某些條件（例如頁面的掛載/資料載入時序跟
  // Playground 不同）在 `contentComponent` 還沒就緒時呼叫，`ReactRenderer` 會
  // 靜默什麼都不渲染（不丟例外，`setRenderer` 呼叫在 optional chaining 下直接被
  // 吞掉）。Faryne 實測發現真實頁面用 `ReactRenderer` 版本時 slash 選單完全叫不
  // 出來（不是 icon 消失，是整個選單都不見），跟這個內部依賴的失效模式完全吻合，
  // Playground 沒事只是因為那邊的掛載時序剛好沒踩到。改用 `createRoot` 後
  // 選單是一個完全獨立的 React root，不依賴 `EditorContent` 的任何內部狀態，
  // 跟原本手刻 DOM 版本一樣「在任何環境都能穩定掛上」，只是內容改成真正的 JSX
  // （修掉 icon 消失的原始問題）。顏色一樣吃 `var(--storyteller-*)` CSS
  // variable（掛在 `:root` 上，跟 React tree 位置無關），不需要 ThemeProvider
  // context 就能正確上色，跟舊版行為一致。
  let root: Root | null = null;
  let unmount: (() => void) | null = null;
  let latestProps: SlashSuggestionProps | null = null;
  let selectedIndex = 0;
  const listboxId = `storyteller-slash-listbox-${++slashCommandListboxCounter}`;
  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  function componentProps(): SlashCommandListProps {
    return {
      items: latestProps?.items ?? [],
      selectedIndex,
      onSelect: (item) => latestProps?.command(item),
      listboxId,
      getOptionId,
    };
  }

  function renderList() {
    root?.render(<SlashCommandList {...componentProps()} />);
  }

  // render 選單內容 + 同步 editor 上的 aria-activedescendant，兩件事永遠一起發生
  // （selectedIndex 一變就要兩邊都更新，分開呼叫容易漏掉其中一邊）。
  function renderAndSyncAria() {
    renderList();
    if (!latestProps) return;
    if (latestProps.items.length === 0) {
      // query 篩選到沒有任何符合的 command 時，沒有選項可以指——清掉
      // aria-activedescendant，不要讓它繼續指向一個已經不存在的舊選項 id。
      setEditorSlashAriaState(latestProps.editor, null);
      return;
    }
    setEditorSlashAriaState(latestProps.editor, {
      listboxId,
      activeOptionId: getOptionId(selectedIndex),
    });
  }

  function mount(props: SlashSuggestionProps) {
    selectedIndex = 0;
    latestProps = props;
    const element = document.createElement("div");
    // `props.mount()` 會把這個 element 直接掛進 `document.body`（或設定的
    // container）並套用 `position:absolute` 定位——它才是「這個選單在整個頁面
    // 的堆疊順序裡排第幾層」的那個節點，z-index 要設在這裡才會生效，設在裡面
    // 的 React 內容（`position:static`）沒有用（CSS 規定 z-index 只對有明確
    // `position` 的元素有效）。真實頁面有 sticky 置頂的標題列等元素會搶堆疊
    // 順序（見 StoryEditor.tsx／LoreEditor.tsx 的 zIndex:2），這裡要蓋過去。
    element.style.zIndex = "1500";
    root = createRoot(element);
    // 掛載當下同步 render，讓 `props.mount()` 量測位置（floating-ui 的
    // `autoUpdate`）時 element 裡已經有實際內容跟尺寸，不會先量到空盒子。
    flushSync(renderAndSyncAria);
    activeSlashCommandControllers.set(props.editor, controller);
    unmount = props.mount(element);
  }

  function update(props: SlashSuggestionProps) {
    if (!root) return;
    latestProps = props;
    selectedIndex = Math.min(
      selectedIndex,
      Math.max(0, props.items.length - 1),
    );
    renderAndSyncAria();
  }

  const controller = {
    onKeyDown(key: SlashCommandKey) {
      if (!latestProps || latestProps.items.length === 0) return false;
      if (key === "ArrowDown") {
        selectedIndex = (selectedIndex + 1) % latestProps.items.length;
        renderAndSyncAria();
        return true;
      }
      if (key === "ArrowUp") {
        selectedIndex =
          (selectedIndex + latestProps.items.length - 1) %
          latestProps.items.length;
        renderAndSyncAria();
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
      root?.unmount();
      if (latestProps) {
        activeSlashCommandControllers.delete(latestProps.editor);
        setEditorSlashAriaState(latestProps.editor, null);
      }
      root = null;
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
      return (
        activeSlashCommandControllers.get(this.editor)?.onKeyDown(key) ?? false
      );
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
