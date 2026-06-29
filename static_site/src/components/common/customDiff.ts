export type CustomDiffState = "same" | "changed" | "added" | "removed";

export interface CustomDiffLine {
  index: number;
  left: string;
  right: string;
  state: CustomDiffState;
}

export function buildCustomLineDiff(left: string, right: string): CustomDiffLine[] {
  const leftLines = left.split("\n");
  const rightLines = right.split("\n");
  const max = Math.max(leftLines.length, rightLines.length);

  return Array.from({ length: max }, (_, index) => {
    const leftLine = leftLines[index] ?? "";
    const rightLine = rightLines[index] ?? "";
    let state: CustomDiffState = "same";

    if (leftLine !== rightLine) {
      if (!leftLine) {
        state = "added";
      } else if (!rightLine) {
        state = "removed";
      } else {
        state = "changed";
      }
    }

    return {
      index: index + 1,
      left: leftLine,
      right: rightLine,
      state,
    };
  });
}
