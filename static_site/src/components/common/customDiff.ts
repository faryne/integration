export type CustomDiffState = "same" | "changed" | "added" | "removed";

export interface CustomDiffLine {
  index: number;
  leftIndex?: number;
  rightIndex?: number;
  left: string;
  right: string;
  state: CustomDiffState;
}

// 段落文字＋這段話在「含空行」的原始行陣列裡的真實行號（1-based）——診斷
// 用的行號要對得上原文，不能因為下面把空行濾掉重排就跟著錯位。
interface IndexedLine {
  text: string;
  originalIndex: number;
}

function indexedNonBlankLines(content: string): IndexedLine[] {
  return content
    .split("\n")
    .map((text, i) => ({ text, originalIndex: i + 1 }))
    .filter((line) => line.text.trim() !== "");
}

function alignLineDiff(leftLines: IndexedLine[], rightLines: IndexedLine[]) {
  const lcs = Array.from({ length: leftLines.length + 1 }, () =>
    Array<number>(rightLines.length + 1).fill(0),
  );
  for (let i = leftLines.length - 1; i >= 0; i--) {
    for (let j = rightLines.length - 1; j >= 0; j--) {
      lcs[i][j] =
        leftLines[i].text === rightLines[j].text
          ? lcs[i + 1][j + 1] + 1
          : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const raw: CustomDiffLine[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftLines.length && rightIndex < rightLines.length) {
    if (leftLines[leftIndex].text === rightLines[rightIndex].text) {
      raw.push({
        index: raw.length + 1,
        leftIndex: leftLines[leftIndex].originalIndex,
        rightIndex: rightLines[rightIndex].originalIndex,
        left: leftLines[leftIndex].text,
        right: rightLines[rightIndex].text,
        state: "same",
      });
      leftIndex++;
      rightIndex++;
    } else if (
      lcs[leftIndex + 1][rightIndex] >= lcs[leftIndex][rightIndex + 1]
    ) {
      raw.push({
        index: raw.length + 1,
        leftIndex: leftLines[leftIndex].originalIndex,
        left: leftLines[leftIndex].text,
        right: "",
        state: "removed",
      });
      leftIndex++;
    } else {
      raw.push({
        index: raw.length + 1,
        rightIndex: rightLines[rightIndex].originalIndex,
        left: "",
        right: rightLines[rightIndex].text,
        state: "added",
      });
      rightIndex++;
    }
  }

  while (leftIndex < leftLines.length) {
    raw.push({
      index: raw.length + 1,
      leftIndex: leftLines[leftIndex].originalIndex,
      left: leftLines[leftIndex].text,
      right: "",
      state: "removed",
    });
    leftIndex++;
  }
  while (rightIndex < rightLines.length) {
    raw.push({
      index: raw.length + 1,
      rightIndex: rightLines[rightIndex].originalIndex,
      left: "",
      right: rightLines[rightIndex].text,
      state: "added",
    });
    rightIndex++;
  }
  return raw;
}

// 兩行文字的相似度（0～1）：用字元 bigram 的 Dice 係數，不需要斷詞，中日文
// 這種沒有空白分詞的文字也能穩定計算。空行沒有比較意義，交給呼叫端另外處理。
function lineSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (s: string) => {
    const counts = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bigram = s.slice(i, i + 2);
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
    return counts;
  };
  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);
  let common = 0;
  for (const [bigram, count] of bigramsA) {
    const countB = bigramsB.get(bigram);
    if (countB) common += Math.min(count, countB);
  }
  let totalA = 0;
  for (const count of bigramsA.values()) totalA += count;
  let totalB = 0;
  for (const count of bigramsB.values()) totalB += count;
  return (2 * common) / (totalA + totalB);
}

// 判斷「移除的這行」跟「新增的那行」算不算同一句話的改寫版本，而不是純粹
// 兩件不相干的事。閾值抓 0.5：字面改動一半以內都還算「同一句話在改寫」。
const CHANGED_PAIR_SIMILARITY_THRESHOLD = 0.5;

// 一個 block 內可能同時混著好幾行「移除」跟好幾行「新增」（例如一段話被整段
// 改寫、中間又夾雜真正全新的段落）。原本的作法是單純按出現順序把第 i 個移除
// 跟第 i 個新增湊一對標成「changed」，但順序湊對完全不看內容像不像，很容易把
// 兩句無關的話錯配成「這是同一句的修改前後」，畫面上一大片橘色卻對不起來，
// 讀起來比純粹的紅／綠新增刪除更誤導。改用類似序列比對（Needleman-Wunsch）
// 的做法：先算每一組移除×新增的相似度，再找一條「保持順序、總相似度最高」
// 的配對路徑，相似度不夠高的就不硬湊，各自留成單純的移除／新增。
function pairChangedLines(
  removed: CustomDiffLine[],
  added: CustomDiffLine[],
): { removedIndex: number; addedIndex: number }[] {
  const m = removed.length;
  const n = added.length;
  if (m === 0 || n === 0) return [];

  const score = Array.from({ length: m }, (_, i) =>
    added.map((line) => {
      const similarity = lineSimilarity(removed[i].left, line.right);
      return similarity >= CHANGED_PAIR_SIMILARITY_THRESHOLD ? similarity : 0;
    }),
  );

  const dp = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.max(
        dp[i - 1][j],
        dp[i][j - 1],
        dp[i - 1][j - 1] + score[i - 1][j - 1],
      );
    }
  }

  const pairs: { removedIndex: number; addedIndex: number }[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (
      score[i - 1][j - 1] > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + score[i - 1][j - 1]
    ) {
      pairs.unshift({ removedIndex: i - 1, addedIndex: j - 1 });
      i--;
      j--;
    } else if (dp[i][j] === dp[i - 1][j]) {
      i--;
    } else {
      j--;
    }
  }
  return pairs;
}

function compactChangedBlocks(raw: CustomDiffLine[]) {
  const lines: CustomDiffLine[] = [];
  for (let index = 0; index < raw.length;) {
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
    const pairs = pairChangedLines(removed, added);
    const pairedRemoved = new Set(pairs.map((pair) => pair.removedIndex));
    const pairedAdded = new Set(pairs.map((pair) => pair.addedIndex));

    for (const pair of pairs) {
      lines.push({
        index: lines.length + 1,
        leftIndex: removed[pair.removedIndex].leftIndex,
        rightIndex: added[pair.addedIndex].rightIndex,
        left: removed[pair.removedIndex].left,
        right: added[pair.addedIndex].right,
        state: "changed",
      });
    }
    for (let i = 0; i < removed.length; i++) {
      if (!pairedRemoved.has(i)) {
        lines.push({ ...removed[i], index: lines.length + 1 });
      }
    }
    for (let j = 0; j < added.length; j++) {
      if (!pairedAdded.has(j)) {
        lines.push({ ...added[j], index: lines.length + 1 });
      }
    }
  }
  return lines;
}

// 段落之間原本一律隔一個空行，這裡把空行整個從比對輸入拿掉，只留下真正有
// 內容的段落去跑 LCS／配對——空行到處都長一樣，讓它們也參與比對只會白白
// 提供大量「免費」的巧合配對，把本來該算同一個編輯區塊的段落切成一堆各自
// 只有一兩行的破碎 block，配對時看不到真正該比較的對象，導致明明相似的
// 兩段話因為被空行拆到不同 block 而配不成一對。渲染要的段落間距，改成算完
// diff 後統一補回單一空行間隔。
function withParagraphSpacers(lines: CustomDiffLine[]): CustomDiffLine[] {
  const result: CustomDiffLine[] = [];
  lines.forEach((line, i) => {
    result.push({ ...line, index: result.length + 1 });
    if (i < lines.length - 1) {
      result.push({
        index: result.length + 1,
        left: "",
        right: "",
        state: "same",
      });
    }
  });
  return result;
}

export function buildCustomLineDiff(
  left: string,
  right: string,
): CustomDiffLine[] {
  const leftLines = indexedNonBlankLines(left);
  const rightLines = indexedNonBlankLines(right);
  const compacted = compactChangedBlocks(alignLineDiff(leftLines, rightLines));
  return withParagraphSpacers(compacted);
}
