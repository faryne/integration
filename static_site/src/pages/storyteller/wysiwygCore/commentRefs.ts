/**
 * 註解參照：註解除了文字，還能夾幾篇同專案的故事／設定，編輯區點註解就能邊寫邊看。
 *
 * 存成註解行內 marker 的 refs 屬性：⟦comment-<id> comment="..." refs="lore:<id> story:<id>"⟧，
 * 空白分隔、最多 COMMENT_REFS_MAX 個。跟 comment 一樣只給作者看，閱讀頁不渲染。
 * 刻意不用 steamloom-lore:// URI：那是讀者看得到的設定連結，後端會擋下指向不存在設定的存檔，
 * 註解參照的那篇被刪掉時不該擋住存檔（後端 comment_reference.go 只回報 info）。
 *
 * mark 上存的是正規化後的字串（formatCommentRefs 的輸出），比對「是不是同一則註解」直接比字串。
 */
export const MARKER_COMMENT_REFS_ATTR = "refs";
/** 跟後端 storyCommentRefMaxPerOne 一致 */
export const COMMENT_REFS_MAX = 5;

export type CommentRefKind = "story" | "lore";
export type CommentRef = { kind: CommentRefKind; publicId: string };

const COMMENT_REF_PATTERN = /^(story|lore):([A-Za-z0-9._~-]+)$/;

/** 解析 refs 屬性值；看不懂的 token 直接忽略、重複的去掉、超過上限的截掉 */
export function parseCommentRefs(
  value: string | null | undefined,
): CommentRef[] {
  const refs: CommentRef[] = [];
  for (const token of (value ?? "").split(/\s+/)) {
    const match = COMMENT_REF_PATTERN.exec(token);
    if (
      match &&
      !refs.some((ref) => ref.kind === match[1] && ref.publicId === match[2])
    ) {
      refs.push({ kind: match[1] as CommentRefKind, publicId: match[2] });
    }
  }
  return refs.slice(0, COMMENT_REFS_MAX);
}

export const formatCommentRefs = (refs: CommentRef[]) =>
  refs.map((ref) => `${ref.kind}:${ref.publicId}`).join(" ");

/** 正規化成 mark 上存的字串；沒有參照時是空字串 */
export const normalizeCommentRefs = (value: string | null | undefined) =>
  formatCommentRefs(parseCommentRefs(value));
