export interface StorytellerContentBlock {
  text: string;
  start: number;
  end: number;
}

// 依空白行把內容切成段落區塊，並記錄每段在原始字串中的字元位移，
// 用來把「游標位置／捲動位置」對應回段落索引。fenced code block（```）內的
// 空白行不會被當成分隔線，避免切壞程式碼區塊。
export function splitStorytellerContentBlocks(
  content: string,
): StorytellerContentBlock[] {
  const blocks: StorytellerContentBlock[] = [];
  let blockLines: string[] = [];
  let blockStart = 0;
  let offset = 0;
  let inFence = false;

  const flush = (end: number) => {
    if (blockLines.length === 0) {
      return;
    }
    blocks.push({ text: blockLines.join("\n"), start: blockStart, end });
    blockLines = [];
  };

  for (const line of content.split("\n")) {
    const lineStart = offset;
    offset += line.length + 1;

    if (/^\s*```/.test(line)) {
      inFence = !inFence;
    }

    if (line.trim() === "" && !inFence) {
      flush(lineStart);
      blockStart = offset;
      continue;
    }

    if (blockLines.length === 0) {
      blockStart = lineStart;
    }
    blockLines.push(line);
  }
  flush(content.length);

  return blocks.length > 0
    ? blocks
    : [{ text: content, start: 0, end: content.length }];
}

// 找出字元位移落在哪一個段落區塊內，找不到時回傳最後一段。
export function findStorytellerBlockIndexByOffset(
  blocks: StorytellerContentBlock[],
  charOffset: number,
): number {
  for (let index = 0; index < blocks.length; index++) {
    if (charOffset <= blocks[index].end) {
      return index;
    }
  }
  return Math.max(0, blocks.length - 1);
}

// 依段落索引把預覽區對應的區塊捲到可視範圍內（游標同步用）。
export function scrollStorytellerPreviewBlockIntoView(
  previewContainer: HTMLElement | null,
  blockIndex: number,
) {
  if (!previewContainer) {
    return;
  }
  const target = previewContainer.querySelector<HTMLElement>(
    `[data-story-block-index="${blockIndex}"]`,
  );
  target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// 依編輯區捲動百分比同步預覽區捲動位置（滑鼠滾輪同步用）。
// textarea 因為自動換行無法精準算出對應段落，改用捲動比例近似同步。
export function syncStorytellerPreviewScrollRatio(
  source: HTMLTextAreaElement,
  previewContainer: HTMLElement | null,
) {
  if (!previewContainer) {
    return;
  }
  const sourceRange = source.scrollHeight - source.clientHeight;
  const targetRange =
    previewContainer.scrollHeight - previewContainer.clientHeight;
  if (sourceRange <= 0 || targetRange <= 0) {
    return;
  }
  const ratio = source.scrollTop / sourceRange;
  previewContainer.scrollTop = ratio * targetRange;
}
