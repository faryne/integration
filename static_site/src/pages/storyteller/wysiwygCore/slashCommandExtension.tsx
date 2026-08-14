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

function isTextOnlySlashQuery(state: EditorState, range: Range) {
  const { selection } = state;
  if (!selection.empty) return false;
  const $from = selection.$from;
  if ($from.parent.type.name !== "paragraph") return false;

  const textBefore = $from.parent.textBetween(0, $from.parentOffset, "");
  const textAfter = $from.parent.textBetween(
    $from.parentOffset,
    $from.parent.content.size,
    "",
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
      "cursor:pointer",
    ].join(";");
    if (index === selectedIndex) {
      button.style.background = "rgba(25, 118, 210, 0.12)";
    }

    const iconMarkup = renderCommandIconMarkup(item.icon);
    if (iconMarkup) {
      const iconSpan = document.createElement("span");
      iconSpan.innerHTML = iconMarkup;
      iconSpan.style.cssText = [
        "display:inline-flex",
        "flex-shrink:0",
        "color:rgba(0, 0, 0, 0.6)",
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
      "border:1px solid rgba(0, 0, 0, 0.12)",
      "border-radius:6px",
      "background:#fff",
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
      maxItems: 8,
    };
  },

  addKeyboardShortcuts() {
    const handleKey = (key: SlashCommandKey) =>
      activeSlashCommandControllers.get(this.editor)?.onKeyDown(key) ?? false;
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
