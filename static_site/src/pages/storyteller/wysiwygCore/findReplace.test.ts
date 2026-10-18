import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { wysiwygCoreExtensions } from "./extensions";
import {
  getFindState,
  replaceAllMatches,
  replaceCurrentMatch,
  setFindQuery,
  stepFindMatch,
} from "./findReplace";
import { markdownToDoc } from "./parser";
import { serializeDocToMarkdown } from "./serializer";

const makeEditor = (markdown: string) =>
  new Editor({
    extensions: wysiwygCoreExtensions,
    content: markdownToDoc(markdown),
  });
// 只看文字跟格式，不看每次存檔都會重新產生的行內 marker id
const output = (editor: Editor) =>
  serializeDocToMarkdown(editor.getJSON()).replace(
    /(span|comment|a|footnote)-[^\s⟧]+/g,
    "$1-x",
  );

describe("尋找／取代", () => {
  it("跨粗體邊界比對，註解文字不算、大小寫預設不分", () => {
    const editor = makeEditor(
      '⟦p1⟧她**回頭**看了Yu一眼⟦/p1⟧\n⟦p2⟧⟦comment-c1 comment="她回頭要改"⟧yu⟦/comment-c1⟧⟦/p2⟧',
    );
    setFindQuery(editor, "她回", false);
    expect(getFindState(editor).matches).toHaveLength(1);
    setFindQuery(editor, "yu", false);
    expect(getFindState(editor).matches).toHaveLength(2);
    setFindQuery(editor, "yu", true);
    expect(getFindState(editor).matches).toHaveLength(1);
    editor.destroy();
  });

  it("取代沿用第一個字的格式，取代字含查詢字也會往後走", () => {
    const editor = makeEditor("⟦p1⟧**宥辰**說，宥辰⟦/p1⟧");
    setFindQuery(editor, "宥辰", false);
    replaceCurrentMatch(editor, "宥辰哥");
    expect(output(editor)).toBe("⟦p1⟧**宥辰哥**說，宥辰⟦/p1⟧");
    // 下一個是第二個「宥辰」，不是剛換好的「宥辰哥」裡那個
    expect(getFindState(editor).current).toBe(1);
    stepFindMatch(editor, 1);
    expect(getFindState(editor).current).toBe(0);
    editor.destroy();
  });

  it("全部取代是一步，⌘Z 一次還原", () => {
    const editor = makeEditor("⟦p1⟧宥辰、宥辰⟦/p1⟧\n⟦p2⟧宥辰⟦/p2⟧");
    const before = output(editor);
    setFindQuery(editor, "宥辰", false);
    expect(replaceAllMatches(editor, "小辰")).toBe(3);
    expect(output(editor)).toBe("⟦p1⟧小辰、小辰⟦/p1⟧\n⟦p2⟧小辰⟦/p2⟧");
    expect(getFindState(editor).matches).toHaveLength(0);
    editor.commands.undo();
    expect(output(editor)).toBe(before);
    editor.destroy();
  });
});
