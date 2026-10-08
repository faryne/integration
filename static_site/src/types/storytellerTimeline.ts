import type { StorytellerAuthorIdentity } from "./storyteller.ts";

// 作者動態／留言／封鎖的型別：對應後端 model/entity/storyteller/author_post.go。
// 身份一律只有 pen_name，前端拿不到帳號或筆名 id。

// 字數上限（含標記本身），跟後端 AuthorPostBodyMaxRunes／CommentBodyMaxRunes 一致
export const AUTHOR_POST_MAX_LENGTH = 1000;
export const COMMENT_MAX_LENGTH = 500;

// 作品卡；作品轉私密、刪除或那一話下架時只有 unavailable
export interface AuthorPostAttachment {
  unavailable?: boolean;
  project_public_id?: string;
  project_slug?: string;
  project_name?: string;
  rating?: "general" | "guidance" | "restricted";
  cover_url?: string;
  story_public_id?: string;
  story_title?: string;
  volume_title?: string;
}

export interface AuthorPost {
  public_id: string;
  author: StorytellerAuthorIdentity;
  // 純文字，含 [spoiler]…[/spoiler]、[r18]…[/r18] 標記
  body: string;
  pinned: boolean;
  attachment?: AuthorPostAttachment;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  is_owner: boolean;
  created_at: string;
}

export interface AuthorPostPage {
  items: AuthorPost[];
  next_cursor: string;
  is_owner: boolean;
}

// 「↪ 回覆 @某人」；被回覆的那則已刪除時 deleted=true、沒有名字
export interface CommentReplyTo {
  public_id?: string;
  pen_name?: string;
  deleted?: boolean;
}

// 已刪除的留言只有 public_id 與 deleted（前端顯示佔位）
export interface AuthorPostComment {
  public_id: string;
  deleted?: boolean;
  // 留言者身份已不存在時沒有這個欄位
  author?: StorytellerAuthorIdentity;
  is_post_author?: boolean;
  body?: string;
  reply_to?: CommentReplyTo;
  // edited／can_edit 只有討論版的留言會有（動態留言不開放編輯）
  edited?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_block?: boolean;
  // 只有貼文擁有者看得到：這位留言者已被封鎖
  blocked?: boolean;
  replies?: AuthorPostComment[];
  created_at?: string;
}

// ok 可留言／login 要登入／pen_name 要先設定筆名／blocked 被作者封鎖
export type CommentViewerState = "ok" | "login" | "pen_name" | "blocked";

export interface AuthorPostDetail {
  post: AuthorPost;
  comments: AuthorPostComment[];
  comment_state: CommentViewerState;
  comment_as?: string;
}

export interface AttachableWork {
  project_public_id: string;
  project_name: string;
  rating: "general" | "guidance" | "restricted";
  stories: { public_id: string; title: string; volume_title?: string }[];
}

export interface AuthorBlock {
  public_id: string;
  blocked: StorytellerAuthorIdentity;
  created_at: string;
}

export interface AuthorPostInput {
  body: string;
  attach_project_public_id?: string;
  attach_story_public_id?: string;
}

export interface CommentInput {
  body: string;
  parent?: string;
  reply_to?: string;
  // 討論版：作品作者用哪個署名身份發言
  as?: string;
}
