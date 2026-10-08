// 作者動態／留言的 [spoiler]…[/spoiler]、[r18]…[/r18] 標記。規則跟後端 service/storyteller/post_text.go 一致：
// 同種標記成對、不支援巢狀、最短匹配；沒關閉的標記當一般文字顯示。

export type PostMarkerKind = "spoiler" | "r18";

export type PostSegment =
  { type: "text"; text: string } | { type: PostMarkerKind; text: string };

const MARKER_RE = /\[(spoiler|r18)\]([\s\S]*?)\[\/\1\]/g;

export const POST_MARKER_LABEL: Record<PostMarkerKind, string> = {
  spoiler: "劇透",
  r18: "R18",
};

export function parsePostBody(body: string): PostSegment[] {
  const segments: PostSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(MARKER_RE)) {
    if (match.index > last) {
      segments.push({ type: "text", text: body.slice(last, match.index) });
    }
    segments.push({ type: match[1] as PostMarkerKind, text: match[2] });
    last = match.index + match[0].length;
  }
  if (last < body.length)
    segments.push({ type: "text", text: body.slice(last) });
  return segments;
}

// 網址自動連結：把一段純文字切成文字與網址
const URL_RE = /https?:\/\/[^\s<>"'）」』]+/g;
export function splitUrls(text: string) {
  const parts: { text: string; url?: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) });
    parts.push({ text: match[0], url: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

// 把 textarea 目前選取的文字包成標記；沒選取就插入一組帶提示文字的標記並選起來，方便直接改
export function wrapTextareaSelection(
  textarea: HTMLTextAreaElement,
  kind: PostMarkerKind,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  const inner =
    value.slice(start, end) || (kind === "r18" ? "限制級內容" : "劇透內容");
  const open = `[${kind}]`;
  const next = `${value.slice(0, start)}${open}${inner}[/${kind}]${value.slice(end)}`;
  return {
    value: next,
    selectionStart: start + open.length,
    selectionEnd: start + open.length + inner.length,
  };
}

// 頁面 meta description 之類的摘要：標記內容換成［劇透］／［R18］，跟後端 maskSpoilers 一致
export const maskPostMarkers = (body: string) =>
  body.replace(
    MARKER_RE,
    (_, kind: PostMarkerKind) => `［${POST_MARKER_LABEL[kind]}］`,
  );

// 送出按鈕可不可以按：有內容、沒超過字數（沒給上限就只檢查有內容）
export const postTextValid = (value: string, maxLength = Infinity) =>
  value.trim().length > 0 && [...value].length <= maxLength;
