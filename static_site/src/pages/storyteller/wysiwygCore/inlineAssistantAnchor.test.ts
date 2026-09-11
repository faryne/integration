import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { wysiwygCoreExtensions } from "./extensions";
import {
  clearInlineAssistantAnchor,
  setInlineAssistantAnchor,
} from "./inlineAssistantAnchor";
import { markdownToDoc } from "./parser";

describe("InlineAssistantAnchor", () => {
  it("移動錨點時文件內始終只有一個 AI host，關閉後完整移除", () => {
    const editor = new Editor({
      extensions: wysiwygCoreExtensions,
      content: markdownToDoc("⟦p1⟧第一段⟦/p1⟧\n⟦p2⟧第二段⟦/p2⟧"),
    });

    try {
      setInlineAssistantAnchor(editor, "p1");
      const firstHost = editor.view.dom.querySelector(
        '[data-storyteller-ai-inline-anchor="true"]',
      );
      expect(firstHost?.parentElement).toBe(editor.view.dom);
      expect(
        firstHost?.previousElementSibling?.getAttribute("data-marker-id"),
      ).toBe("p1");

      setInlineAssistantAnchor(editor, "p2");
      const movedHost = editor.view.dom.querySelector(
        '[data-storyteller-ai-inline-anchor="true"]',
      );
      expect(
        editor.view.dom.querySelectorAll(
          '[data-storyteller-ai-inline-anchor="true"]',
        ),
      ).toHaveLength(1);
      expect(
        movedHost?.previousElementSibling?.getAttribute("data-marker-id"),
      ).toBe("p2");

      clearInlineAssistantAnchor(editor);
      expect(
        editor.view.dom.querySelector(
          '[data-storyteller-ai-inline-anchor="true"]',
        ),
      ).toBeNull();
    } finally {
      editor.destroy();
    }
  });
});
