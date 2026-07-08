import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import History from "@tiptap/extension-history";
import Italic from "@tiptap/extension-italic";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import Text from "@tiptap/extension-text";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";

import { MarkerParagraph } from "./markerParagraph";
import { ALIGNMENT_VALUES, DEFAULT_ALIGNMENT } from "./whitelist";

/**
 * 這份清單本身就是「schema 只有白名單允許的節點/樣式」的落地：
 * 沒有 Heading / BulletList / OrderedList / Blockquote / CodeBlock 等節點，
 * 使用者打 `#`、`- ` 這類語法時，schema 裡根本沒有對應節點可以被解析成，
 * 只會原地留在段落文字裡（滿足「非白名單語法略過解析、以純文字顯示」）。
 */
export const wysiwygCoreExtensions = [
  Document,
  MarkerParagraph,
  Text,
  Bold,
  Italic,
  Underline,
  Subscript,
  Superscript,
  TextAlign.configure({
    types: ["paragraph"],
    alignments: [...ALIGNMENT_VALUES],
    defaultAlignment: DEFAULT_ALIGNMENT,
  }),
  History,
  Dropcursor,
  Gapcursor,
];
