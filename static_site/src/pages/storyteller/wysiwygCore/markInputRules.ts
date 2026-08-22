import { markInputRule, markPasteRule } from "@tiptap/core";
import Italic from "@tiptap/extension-italic";
import Strike from "@tiptap/extension-strike";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Underline from "@tiptap/extension-underline";

/**
 * 官方 Bold/Italic/Strike extension 的 input rule 都是照抄同一個模板（見各自套件原始碼的
 * starInputRegex／inputRegex）：`(?:^|\s)(delimiter(?!\s+delimiter)((?:[^delimiterChar]+))delimiter(?!\s+delimiter))$`，
 * 只是 delimiter 字元不同。這裡照白名單的 delimiter 自己刻對應版本，用在 Underline／
 * Subscript／Superscript（官方版完全沒有 input rule）跟 Strike（官方版預設吃 `~~`，
 * 我們的白名單是 `--`）。
 */
function delimiterInputRegex(delimiter: string): RegExp {
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charClass = `[^${delimiter[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`;
  return new RegExp(
    `(?:^|\\s)(${escaped}(?!\\s+${escaped})(${charClass}+)${escaped}(?!\\s+${escaped}))$`,
  );
}

function delimiterPasteRegex(delimiter: string): RegExp {
  const escaped = delimiter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const charClass = `[^${delimiter[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`;
  return new RegExp(
    `(?:^|\\s)(${escaped}(?!\\s+${escaped})(${charClass}+)${escaped}(?!\\s+${escaped}))`,
    "g",
  );
}

// 官方 Italic 預設同時吃 `*文字*` 跟 `_文字_`，但白名單只認 `*`（見 whitelist.ts）——
// 保留 `_文字_` 會誤把使用者打的字面底線觸發成斜體，這裡只保留星號版的 input/paste rule。
export const CustomItalic = Italic.extend({
  addInputRules() {
    return [markInputRule({ find: delimiterInputRegex("*"), type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: delimiterPasteRegex("*"), type: this.type })];
  },
});

// 官方 Underline 完全沒有 input rule，白名單語法是 `++文字++`。
export const CustomUnderline = Underline.extend({
  addInputRules() {
    return [
      markInputRule({ find: delimiterInputRegex("++"), type: this.type }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({ find: delimiterPasteRegex("++"), type: this.type }),
    ];
  },
});

// 官方 Subscript 完全沒有 input rule，白名單語法是 `~文字~`。
export const CustomSubscript = Subscript.extend({
  addInputRules() {
    return [markInputRule({ find: delimiterInputRegex("~"), type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: delimiterPasteRegex("~"), type: this.type })];
  },
});

// 官方 Superscript 完全沒有 input rule，白名單語法是 `^文字^`。
export const CustomSuperscript = Superscript.extend({
  addInputRules() {
    return [markInputRule({ find: delimiterInputRegex("^"), type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: delimiterPasteRegex("^"), type: this.type })];
  },
});

// 官方 Strike 預設吃 `~~文字~~`，白名單語法是 `--文字--`（`~~` 留給下標 `~` 用，
// 兩者不能共用同一個字元）。
export const CustomStrike = Strike.extend({
  addInputRules() {
    return [markInputRule({ find: delimiterInputRegex("--"), type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: delimiterPasteRegex("--"), type: this.type })];
  },
});
