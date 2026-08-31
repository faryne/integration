import { useLayoutEffect, useRef, type RefObject } from "react";
import { Box } from "@mui/material";
import { segmentStorytellerAgentPromptForHighlight } from "@/pages/storyteller/storytellerAgentReferences.ts";

// 疊在輸入框「文字看不見的那顆真正 textarea」底下的純視覺層，讓 @thisStory／
// @story:[...] 這類引用語法在打字當下就變色。textarea 本身還是原生元素，
// IME 組字、游標、貼上都交給瀏覽器處理，不用重寫一個 contenteditable 編輯器；
// 這層只負責「畫出跟 textarea 文字位置完全對齊的高亮版本」，本身不接收任何
// 互動（pointerEvents: none）。
//
// 對齊靠即時讀 textarea 的 computed style／幾何位置去複製，而不是猜死
// MUI TextField 目前版本的 padding／border 數值——MUI 內部樣式改了，這裡照樣
// 對得上，不用跟著調參數。
const MIRRORED_TEXT_STYLE_PROPERTIES = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "tabSize",
] as const;

export function StorytellerPromptHighlightOverlay({
  text,
  textareaRef,
  slashCommandHighlightLength = 0,
}: {
  text: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /**
   * 開頭幾個字元要當「slash command」上色，由呼叫端算好傳進來（呼叫端才知道
   * `/rewrite` 這種 skill 指令或 `/Agent 名稱` 是不是真的存在——這層只負責畫，
   * 不驗證語意，不然任何 `/亂打` 都會被誤標成合法指令）。
   */
  slashCommandHighlightLength?: number;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) {
      return;
    }

    function syncGeometryAndStyle() {
      if (!textarea || !overlay) {
        return;
      }
      const computed = window.getComputedStyle(textarea);
      for (const property of MIRRORED_TEXT_STYLE_PROPERTIES) {
        overlay.style[property] = computed[property];
      }
      overlay.style.paddingTop = computed.paddingTop;
      overlay.style.paddingRight = computed.paddingRight;
      overlay.style.paddingBottom = computed.paddingBottom;
      overlay.style.paddingLeft = computed.paddingLeft;
      overlay.style.borderTopWidth = computed.borderTopWidth;
      overlay.style.borderRightWidth = computed.borderRightWidth;
      overlay.style.borderBottomWidth = computed.borderBottomWidth;
      overlay.style.borderLeftWidth = computed.borderLeftWidth;
      overlay.style.boxSizing = computed.boxSizing;
      overlay.style.top = `${textarea.offsetTop}px`;
      overlay.style.left = `${textarea.offsetLeft}px`;
      overlay.style.width = `${textarea.offsetWidth}px`;
      overlay.style.height = `${textarea.offsetHeight}px`;
      overlay.scrollTop = textarea.scrollTop;
      overlay.scrollLeft = textarea.scrollLeft;
    }

    syncGeometryAndStyle();

    const resizeObserver = new ResizeObserver(syncGeometryAndStyle);
    resizeObserver.observe(textarea);
    textarea.addEventListener("scroll", syncGeometryAndStyle);
    window.addEventListener("resize", syncGeometryAndStyle);
    return () => {
      resizeObserver.disconnect();
      textarea.removeEventListener("scroll", syncGeometryAndStyle);
      window.removeEventListener("resize", syncGeometryAndStyle);
    };
  }, [text, textareaRef]);

  const slashLength = Math.max(
    0,
    Math.min(slashCommandHighlightLength, text.length),
  );
  const segments =
    slashLength > 0
      ? [
          { text: text.slice(0, slashLength), kind: "slash-command" as const },
          ...segmentStorytellerAgentPromptForHighlight(text.slice(slashLength)),
        ]
      : segmentStorytellerAgentPromptForHighlight(text);

  return (
    <Box
      ref={overlayRef}
      aria-hidden
      sx={{
        position: "absolute",
        overflow: "hidden",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        pointerEvents: "none",
        // 這層才是使用者實際看到的文字（真正的 textarea 文字被設成透明），一般
        // 片段要用正常可見的顏色，不能沿用容器預設值。
        color: "text.primary",
        borderStyle: "solid",
        borderColor: "transparent",
      }}
    >
      {segments.map((segment, index) =>
        segment.kind ? (
          <Box
            key={index}
            component="span"
            sx={{
              color:
                segment.kind === "slash-command"
                  ? "secondary.main"
                  : "primary.main",
              fontWeight: segment.kind === "slash-command" ? 800 : 700,
            }}
          >
            {segment.text}
          </Box>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </Box>
  );
}
