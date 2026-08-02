export type CustomDiffState = "same" | "changed" | "added" | "removed";

export interface CustomDiffLine {
  index: number;
  leftIndex?: number;
  rightIndex?: number;
  left: string;
  right: string;
  state: CustomDiffState;
}

function alignLineDiff(leftLines: string[], rightLines: string[]) {
  const lcs = Array.from({ length: leftLines.length + 1 }, () =>
    Array<number>(rightLines.length + 1).fill(0),
  );
  for (let i = leftLines.length - 1; i >= 0; i--) {
    for (let j = rightLines.length - 1; j >= 0; j--) {
      lcs[i][j] =
        leftLines[i] === rightLines[j]
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const raw: CustomDiffLine[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex] === rightLines[rightIndex]) {
      raw.push({
        index: raw.length + 1,
        leftIndex: leftIndex + 1,
        rightIndex: rightIndex + 1,
        left: leftLines[leftIndex],
        right: rightLines[rightIndex],
        state: "same",
      });
      leftIndex++;
      rightIndex++;
    } else if (lcs[leftIndex + 1][rightIndex] >= lcs[leftIndex][rightIndex + 1]) {
      raw.push({
        index: raw.length + 1,
        leftIndex: leftIndex + 1,
        left: leftLines[leftIndex],
        right: "",
        state: "removed",
      });
      leftIndex++;
    } else {
      raw.push({
        index: raw.length + 1,
        rightIndex: rightIndex + 1,
        left: "",
        right: rightLines[rightIndex],
        state: "added",
      });
      rightIndex++;
    }
  }

  while (leftIndex < leftLines.length) {
    raw.push({
      index: raw.length + 1,
      leftIndex: leftIndex + 1,
      left: leftLines[leftIndex],
      right: "",
      state: "removed",
    });
    leftIndex++;
  }
  while (rightIndex < rightLines.length) {
    raw.push({
      index: raw.length + 1,
      rightIndex: rightIndex + 1,
      left: "",
      right: rightLines[rightIndex],
      state: "added",
    });
    rightIndex++;
  }
  return raw;
}

function compactChangedBlocks(raw: CustomDiffLine[]) {
  const lines: CustomDiffLine[] = [];
  for (let index = 0; index < raw.length; ) {
    if (raw[index].state === "same") {
      lines.push({ ...raw[index], index: lines.length + 1 });
      index++;
      continue;
    }

    const block: CustomDiffLine[] = [];
    while (index < raw.length && raw[index].state !== "same") {
      block.push(raw[index]);
      index++;
    }
    const removed = block.filter((line) => line.state === "removed");
    const added = block.filter((line) => line.state === "added");
    const pairCount = Math.min(removed.length, added.length);
    for (let i = 0; i < pairCount; i++) {
      lines.push({
        index: lines.length + 1,
        leftIndex: removed[i].leftIndex,
        rightIndex: added[i].rightIndex,
        left: removed[i].left,
        right: added[i].right,
        state: "changed",
      });
    }
    for (let i = pairCount; i < removed.length; i++) {
      lines.push({ ...removed[i], index: lines.length + 1 });
    }
    for (let i = pairCount; i < added.length; i++) {
      lines.push({ ...added[i], index: lines.length + 1 });
    }
  }
  return lines;
}

export function buildCustomLineDiff(left: string, right: string): CustomDiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  return compactChangedBlocks(alignLineDiff(leftLines, rightLines));
}
