import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { wysiwygCoreExtensions } from "./extensions";
import {
  clearInlineAssistantAnchor,
  setInlineAssistantAnchor,
} from "./inlineAssistantAnchor";
import { markdownToDoc } from "./parser";

const HOST_SELECTOR = '[data-storyteller-ai-inline-anchor="true"]';

function getHost(editor: Editor) {
  return editor.view.dom.querySelector<HTMLElement>(HOST_SELECTOR);
}

function getParagraphPos(editor: Editor, markerId: string) {
  let paragraphPos: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.attrs.markerId !== markerId) return true;
    paragraphPos = pos;
    return false;
  });
  if (paragraphPos === null)
    throw new Error(`找不到段落 markerId: ${markerId}`);
  return paragraphPos;
}

function expectHostAfterMarker(editor: Editor, markerId: string) {
  expect(
    getHost(editor)?.previousElementSibling?.getAttribute("data-marker-id"),
  ).toBe(markerId);
}

describe("InlineAssistantAnchor", () => {
  it("移動錨點時文件內始終只有一個 AI host，關閉後完整移除", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc("⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段⟦/p2⟧"),
    });

    try {
      setInlineAssistantAnchor(editor, "p1");
      const firstHost = getHost(editor);
      expect(firstHost?.parentElement).toBe(editor.view.dom);
      expectHostAfterMarker(editor, "p1");

      setInlineAssistantAnchor(editor, "p2");
      expect(editor.view.dom.querySelectorAll(HOST_SELECTOR)).toHaveLength(1);
      expectHostAfterMarker(editor, "p2");

      clearInlineAssistantAnchor(editor);
      expect(getHost(editor)).toBeNull();
    } finally {
      editor.destroy();
    }
  });

  it("目標段落向前合併後沿用同一個 host，並降級到文件末端", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(
        "⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段⟦/p2⟧\n⟦p3⟧第三段⟦/p3⟧",
      ),
    });

    try {
      setInlineAssistantAnchor(editor, "p2");
      const originalHost = getHost(editor);
      const portalContent = document.createElement("span");
      portalContent.textContent = "AI workspace";
      originalHost?.append(portalContent);

      editor.commands.setTextSelection(getParagraphPos(editor, "p2") + 1);
      expect(editor.commands.joinBackward()).toBe(true);

      expect(getHost(editor)).toBe(originalHost);
      expect(getHost(editor)?.contains(portalContent)).toBe(true);
      expectHostAfterMarker(editor, "p3");
    } finally {
      editor.destroy();
    }
  });

  it("目標段落整段刪除後沿用同一個 host，並降級到文件末端", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(
        "⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段⟦/p2⟧\n⟦p3⟧第三段⟦/p3⟧",
      ),
    });

    try {
      setInlineAssistantAnchor(editor, "p2");
      const originalHost = getHost(editor);
      const paragraphPos = getParagraphPos(editor, "p2");
      const paragraph = editor.state.doc.nodeAt(paragraphPos);
      expect(paragraph).not.toBeNull();

      editor.commands.deleteRange({
        from: paragraphPos,
        to: paragraphPos + (paragraph?.nodeSize ?? 0),
      });

      expect(getHost(editor)).toBe(originalHost);
      expectHostAfterMarker(editor, "p3");
    } finally {
      editor.destroy();
    }
  });

  it("目標段落拆成兩段後，host 跟著保留原 markerId 的前半段", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc("⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段文字⟦/p2⟧"),
    });

    try {
      setInlineAssistantAnchor(editor, "p2");
      const originalHost = getHost(editor);
      editor.commands.setTextSelection(getParagraphPos(editor, "p2") + 4);
      expect(editor.commands.splitParagraphFresh()).toBe(true);

      expect(getHost(editor)).toBe(originalHost);
      expectHostAfterMarker(editor, "p2");
      expect(
        getHost(editor)?.nextElementSibling?.getAttribute("data-marker-id"),
      ).not.toBe("p2");
    } finally {
      editor.destroy();
    }
  });

  it("合併目標段落後 undo／redo 都維持同一個 host 並解析到正確位置", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc(
        "⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段⟦/p2⟧\n⟦p3⟧第三段⟦/p3⟧",
      ),
    });

    try {
      setInlineAssistantAnchor(editor, "p2");
      const originalHost = getHost(editor);
      editor.commands.setTextSelection(getParagraphPos(editor, "p2") + 1);
      expect(editor.commands.joinBackward()).toBe(true);
      expectHostAfterMarker(editor, "p3");

      expect(editor.commands.undo()).toBe(true);
      expect(getHost(editor)).toBe(originalHost);
      expectHostAfterMarker(editor, "p2");

      expect(editor.commands.redo()).toBe(true);
      expect(getHost(editor)).toBe(originalHost);
      expectHostAfterMarker(editor, "p3");

      expect(editor.commands.undo()).toBe(true);
      expect(getHost(editor)).toBe(originalHost);
      expectHostAfterMarker(editor, "p2");
    } finally {
      editor.destroy();
    }
  });
});
