import type { StorytellerAuthorIdentity } from "./storyteller.ts";
import type {
  AuthorPostComment,
  CommentViewerState,
} from "./storytellerTimeline.ts";

// 專案討論版的型別：對應後端 model/entity/storyteller/discussion.go。

export type DiscussionAnchorType = "story" | "lore";

// 錨點已不可見（下架、刪除）時只有 unavailable
export interface DiscussionAnchor {
  type: DiscussionAnchorType;
  public_id?: string;
  title?: string;
  volume_title?: string;
  unavailable?: boolean;
}

export interface DiscussionThread {
  public_id: string;
  title: string;
  // 只有單串詳情會帶
  body?: string;
  // 發串者身份已不存在時沒有
  author?: StorytellerAuthorIdentity;
  is_project_author?: boolean;
  anchor?: DiscussionAnchor;
  reply_count: number;
  edited?: boolean;
  locked?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_lock?: boolean;
  can_block?: boolean;
  // 只有作品作者看得到：發串者已被封鎖
  blocked?: boolean;
  last_activity_at: string;
  created_at: string;
}

// 看的人能不能發言、可以用哪些身份（作者＝作品署名過的身份，讀者＝本人）
export interface DiscussionViewer {
  state: CommentViewerState;
  as?: string[];
}

export interface DiscussionList {
  items: DiscussionThread[];
  total: number;
  page: number;
  viewer: DiscussionViewer;
}

export interface DiscussionThreadDetail {
  thread: DiscussionThread;
  comments: AuthorPostComment[];
  viewer: DiscussionViewer;
}

export type DiscussionFilter = "all" | "general" | "story" | "lore";
export type DiscussionSort = "latest" | "newest";

export interface DiscussionThreadInput {
  title: string;
  body: string;
  anchor_story?: string;
  anchor_lore?: string;
  as?: string;
}
