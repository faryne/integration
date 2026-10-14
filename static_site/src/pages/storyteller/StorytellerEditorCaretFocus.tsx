import type { Editor } from "@tiptap/core";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import { Box, Button } from "@mui/material";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { ShortcutHint } from "@/components/common/ShortcutHint.tsx";
import { usePrimaryShortcut } from "@/helpers/shortcut.ts";
import {
  CARET_BLOCK_CLASS,
  caretBlock,
} from "@/pages/storyteller/wysiwygCore/caretFocus.ts";
import { findParagraphPosByMarkerId } from "@/pages/storyteller/wysiwygCore/jumpToMarker.ts";

// 長文找回輸入焦點（網站與 SteamLoom Writer 共用，Writer 透過 alias 直接 import）：
// 1. 捲軸上標出游標所在位置
// 2. 游標捲出畫面時浮出「回到輸入位置」，⌘J／Ctrl+J 也可以（macOS 的「跳到選取處」）
// 3. 記住每篇最後的游標位置（以段落 markerId 記，中間增刪段落也不會跑掉），下次打開捲回去
// 目前段落的底色標示是 wysiwygCore/caretFocus.ts 的 decoration，樣式在下面的 CARET_BLOCK_SX。

const JUMP_SHORTCUT = "j";
const storageKey = (memoryKey: string) => `steamloom.editor.caret.${memoryKey}`;

// 目前段落：淡底色＋左側外凸一條強調色。用 box-shadow 往左畫、background-image 疊色，
// 不動 padding／background-color，才不會跟書籤（inset 左線＋底色）、code block 底色、引用縮排互相蓋掉。
const accent = (percent: number) =>
  `color-mix(in srgb, var(--mui-palette-primary-main) ${percent}%, transparent)`;
export const CARET_BLOCK_SX = {
  [`& .ProseMirror .${CARET_BLOCK_CLASS}`]: {
    backgroundImage: `linear-gradient(${accent(7)}, ${accent(7)})`,
    boxShadow: `-5px 0 0 0 ${accent(7)}, -8px 0 0 0 ${accent(70)}`,
  },
} as const;

interface CaretState {
  /** 游標在整篇內容中的相對位置（0～1），內容沒超出容器時為 null，不畫捲軸標記。 */
  ratio: number | null;
  /** 游標不在可視範圍內時，在上方還是下方；在畫面內為 null。 */
  offscreen: "above" | "below" | null;
}

export function StorytellerEditorCaretFocus({
  editor,
  scrollRef,
  memoryKey,
  jumpLabel = "回到輸入位置",
}: {
  editor: Editor | null;
  /** 正文的捲動容器（overflow: auto 那層）。 */
  scrollRef: RefObject<HTMLElement | null>;
  /** 每篇文件唯一的 key，給了才記住游標位置。 */
  memoryKey?: string;
  jumpLabel?: string;
}) {
  const [caret, setCaret] = useState<CaretState>({
    ratio: null,
    offscreen: null,
  });
  // 作者實際在編輯器裡點過或還原過游標才顯示「回到輸入位置」，避免剛打開、只是往下讀時就跳出來
  const engagedRef = useRef(false);

  const caretRect = useCallback(() => {
    const container = scrollRef.current;
    if (!editor || editor.isDestroyed || !container) return null;
    try {
      const coords = editor.view.coordsAtPos(editor.state.selection.head);
      return { coords, container, box: container.getBoundingClientRect() };
    } catch {
      // view 還沒掛好或位置失效（內容剛被整份換掉）
      return null;
    }
  }, [editor, scrollRef]);

  const measure = useCallback(() => {
    const rect = caretRect();
    if (!rect) return;
    const { coords, container, box } = rect;
    const scrollable = container.scrollHeight > container.clientHeight + 1;
    const y = coords.top - box.top + container.scrollTop;
    const offscreen =
      coords.bottom < box.top
        ? "above"
        : coords.top > box.bottom
          ? "below"
          : null;
    setCaret({
      ratio: scrollable
        ? Math.min(1, Math.max(0, y / container.scrollHeight))
        : null,
      offscreen: engagedRef.current ? offscreen : null,
    });
  }, [caretRect]);

  // 把游標捲到容器中間；focus 用 preventScroll，直接對編輯區 .focus() 會把容器捲回開頭（見 jumpToMarker.ts）
  const scrollToCaret = useCallback(
    (behavior: ScrollBehavior) => {
      const rect = caretRect();
      if (!rect) return;
      const { coords, container, box } = rect;
      container.scrollTo({
        top:
          container.scrollTop +
          coords.top -
          box.top -
          container.clientHeight / 2,
        behavior,
      });
    },
    [caretRect],
  );
  // 先 focus 再捲：focus 時瀏覽器會把選取範圍「就近」捲進畫面，先捲的話平滑捲動會被打斷，停在邊緣而不是正中間
  const jump = useCallback(() => {
    editor?.view.dom.focus({ preventScroll: true });
    requestAnimationFrame(() => scrollToCaret("smooth"));
  }, [editor, scrollToCaret]);

  // 位置追蹤：捲動、游標移動、內容或容器尺寸變動都重算（rAF 合併同一幀的多次觸發）
  useEffect(() => {
    const container = scrollRef.current;
    if (!editor || !container) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const engage = () => {
      engagedRef.current = true;
      schedule();
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(container);
    resize.observe(editor.view.dom);
    container.addEventListener("scroll", schedule, { passive: true });
    editor.on("selectionUpdate", schedule);
    editor.on("update", schedule);
    editor.on("focus", engage);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      container.removeEventListener("scroll", schedule);
      editor.off("selectionUpdate", schedule);
      editor.off("update", schedule);
      editor.off("focus", engage);
    };
  }, [editor, measure, scrollRef]);

  // 掛在 window：剛打開頁面、焦點在標題或其他欄位時也能直接跳回上次的輸入位置
  usePrimaryShortcut(JUMP_SHORTCUT, () => {
    engagedRef.current = true;
    jump();
  });

  // 記住游標：只記作者自己移動的游標（編輯器有焦點時），程式還原或載入時的選取不算；停 0.5 秒才寫
  useEffect(() => {
    if (!editor || !memoryKey) return;
    let timer = 0;
    const save = () => {
      if (!editor.isFocused) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const block = caretBlock(editor.state);
        const markerId = block?.node.attrs.markerId as string | undefined;
        if (!block || !markerId) return;
        const offset = editor.state.selection.head - (block.pos + 1);
        try {
          window.localStorage.setItem(
            storageKey(memoryKey),
            JSON.stringify({ markerId, offset }),
          );
        } catch {
          // 無痕模式等存不了就算了，不影響寫作
        }
      }, 500);
    };
    editor.on("selectionUpdate", save);
    return () => {
      window.clearTimeout(timer);
      editor.off("selectionUpdate", save);
    };
  }, [editor, memoryKey]);

  // 還原游標：內容可能晚一點才載入（先空白再換成整篇），每次 transaction 都試，找到段落就還原一次；
  // 內容已載入卻找不到（那段被刪了）就放棄，維持預設的開頭位置。
  useEffect(() => {
    if (!editor || !memoryKey) return;
    let saved: { markerId: string; offset: number } | null = null;
    try {
      saved = JSON.parse(
        window.localStorage.getItem(storageKey(memoryKey)) ?? "null",
      );
    } catch {
      saved = null;
    }
    if (!saved?.markerId) return;
    const { markerId, offset } = saved;
    let done = false;
    const attempt = () => {
      if (done || editor.isDestroyed) return;
      const { doc } = editor.state;
      const pos = findParagraphPosByMarkerId(doc, markerId);
      if (pos === null) {
        if (doc.textContent.length > 0) done = true;
        return;
      }
      done = true;
      const node = doc.nodeAt(pos);
      const end = pos + (node?.nodeSize ?? 2) - 1;
      editor.commands.setTextSelection(
        Math.min(pos + 1 + Math.max(0, offset), end),
      );
      engagedRef.current = true;
      requestAnimationFrame(() => scrollToCaret("auto"));
    };
    editor.on("transaction", attempt);
    attempt();
    return () => {
      editor.off("transaction", attempt);
    };
  }, [editor, memoryKey, scrollToCaret]);

  return (
    <>
      {caret.ratio !== null && (
        // 疊在捲軸上的游標標記，不攔滑鼠事件，捲軸照常拖得動
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            top: `calc(${caret.ratio * 100}% - 2px)`,
            right: 0,
            width: 10,
            height: 4,
            borderRadius: 1,
            bgcolor: "primary.main",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      )}
      {caret.offscreen && (
        <Button
          size="small"
          variant="contained"
          onClick={jump}
          startIcon={
            caret.offscreen === "above" ? (
              <ArrowUpwardIcon />
            ) : (
              <ArrowDownwardIcon />
            )
          }
          sx={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            ...(caret.offscreen === "above" ? { top: 12 } : { bottom: 12 }),
            zIndex: 3,
            borderRadius: 4,
            boxShadow: 3,
          }}
        >
          {jumpLabel}
          <ShortcutHint shortcutKey={JUMP_SHORTCUT} />
        </Button>
      )}
    </>
  );
}
