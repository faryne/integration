import type { StorytellerAuthorIdentity } from "./storyteller.ts";

// 站內通知的型別：對應後端 model/entity/storyteller/notification.go。
// payload 是寫入當下的快照，各 kind 只會帶自己用得到的欄位。

// kind 不在前端寫死：文字、分類、呈現方式都由 GET /storyteller/notification-kinds 提供
// （後端註冊表 model/entity/storyteller/notification_kind.go）。前端只認識下面幾種畫面。
export type StorytellerNotificationView =
  | "stories"
  | "project"
  | "security"
  | "generic"
  | "follower"
  | "favorite"
  | "posted"
  | "comment";

export interface StorytellerNotificationKindDefinition {
  kind: string;
  label: string;
  category: "content" | "security" | "general" | "social";
  // 後端之後若出現前端不認識的 view，前端一律退回 generic
  view: StorytellerNotificationView | (string & {});
}

export type StorytellerNotificationFilter = "all" | "unread" | "locked";

export interface StorytellerNotificationStory {
  public_id: string;
  title: string;
  word_count: number;
  volume_title?: string;
}

export interface StorytellerNotificationPayload {
  // 通用欄位：title／body 所有類型都必填（純文字、保留換行）；link 選填，站內路徑或 http(s) 網址
  title: string;
  body: string;
  link?: string;
  // 內容更新
  project_public_id?: string;
  project_slug?: string;
  project_name?: string;
  rating?: "general" | "guidance" | "restricted";
  authors?: string[];
  stories?: StorytellerNotificationStory[];
  story_total?: number;
  description?: string;
  tags?: string[];
  word_total?: number;
  // 安全
  client_name?: string;
  credential_public_id?: string;
  label?: string;
  token_prefix?: string;
  expires_at?: string;
  source?: string;
  ip?: string;
  user_agent?: string;
  // 追蹤／收藏：actor 是追蹤者（後端已換成目前的筆名，身份不存在時沒有這個欄位）；
  // target_pen_name 是被追蹤的是我的哪個筆名，本人身份留空
  actor?: StorytellerAuthorIdentity;
  target_pen_name?: string;
  // 作者動態（author.posted／post.commented／post.replied）：摘要後端已把劇透／R18 遮成［劇透］／［R18］。
  // post_author 是貼文身份目前的筆名；deleted 是輸出時才判斷的「貼文或留言已刪除」
  post_public_id?: string;
  post_author?: string;
  post_excerpt?: string;
  comment_public_id?: string;
  comment_excerpt?: string;
  // 留言所在那一串的頂層留言（頂層留言就是自己），從通知直接回覆時當 parent
  thread_public_id?: string;
  // 被回覆的是我哪一則留言的摘要（post.replied）
  parent_excerpt?: string;
  // work 是附上的作品卡名稱（「《作品》第 13 話」），沒附就沒有
  posts?: { public_id: string; excerpt: string; work?: string }[];
  deleted?: boolean;
  // 已刪除且是站方移除時的理由 slug
  delete_reason?: string;
}

// 回追狀態：none 可回追／following 已互相追蹤／unavailable 對方或我的身份已不存在
export interface StorytellerNotificationFollowBack {
  state: "none" | "following" | "unavailable";
  // 可以拿來回追的我的身份；作品有多個署名身份時會有多筆
  identities: { pen_name: string; is_self?: boolean }[];
}

export interface StorytellerNotification {
  public_id: string;
  kind: string;
  payload: StorytellerNotificationPayload;
  read: boolean;
  locked: boolean;
  // null 代表已鎖定、不會被保留期清除
  expires_at: string | null;
  created_at: string;
  // 只有追蹤／收藏類通知才有
  follow_back?: StorytellerNotificationFollowBack;
}

export interface StorytellerNotificationPage {
  items: StorytellerNotification[];
  next_cursor: string;
  unread_count: number;
  locked_count: number;
  lock_limit: number;
}
