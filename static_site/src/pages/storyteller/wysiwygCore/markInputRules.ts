import { markInputRule, markPasteRule } from "@tiptap/core";
import Bold, {
  underscoreInputRegex,
  underscorePasteRegex,
} from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
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

// 粗體 `**`：官方規則要求開頭的 `**` 前面是行首或空白（英文習慣），中文句子裡「這是**粗體**」
// 前面緊貼著字，打字跟貼上都不會轉換。改用 lookbehind：只要前一個字不是 `*`（避免從 `***` 中間
// 誤判）或 `\`（跳脫）就成立。不能用一般的前綴群組：markInputRule／markPasteRule 會把比對到的
// 前綴當成空白一起刪掉，前一個字會被吃掉。`__` 維持官方規則（要求空白），避免 snake_case 被誤判；
// 單字元的 `*`、`~`、`^` 也維持需要空白，放寬後像「1~2 和 3~4」這種文字會被誤判成格式。
const starBoldInputRegex = /(?<![*\\])(\*\*(?!\s+\*\*)([^*]+)\*\*(?!\s+\*\*))$/;
const starBoldPasteRegex = /(?<![*\\])(\*\*(?!\s+\*\*)([^*]+)\*\*(?!\s+\*\*))/g;

export const CustomBold = Bold.extend({
  addInputRules() {
    return [
      markInputRule({ find: starBoldInputRegex, type: this.type }),
      markInputRule({ find: underscoreInputRegex, type: this.type }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({ find: starBoldPasteRegex, type: this.type }),
      markPasteRule({ find: underscorePasteRegex, type: this.type }),
    ];
  },
});

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
    return [
      markInputRule({ find: delimiterInputRegex("--"), type: this.type }),
    ];
  },
  addPasteRules() {
    return [
      markPasteRule({ find: delimiterPasteRegex("--"), type: this.type }),
    ];
  },
});

// 官方 Code 沒有符合本編輯器白名單的反引號 input/paste rule，這裡補成 `文字`。
export const CustomCode = Code.extend({
  // 官方預設 excludes: "_" 會排斥所有其他 mark；這裡要允許粗體等外層 mark 包住 code。
  excludes: "",
  addInputRules() {
    return [markInputRule({ find: delimiterInputRegex("`"), type: this.type })];
  },
  addPasteRules() {
    return [markPasteRule({ find: delimiterPasteRegex("`"), type: this.type })];
  },
});
