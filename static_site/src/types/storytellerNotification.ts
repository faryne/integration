// 站內通知的型別：對應後端 model/entity/storyteller/notification.go。
// payload 是寫入當下的快照，各 kind 只會帶自己用得到的欄位。

// 後端可能先上線前端還不認識的類型，所以保留任意字串；不認識的一律用 payload 的通用欄位顯示
export type StorytellerNotificationKind =
  | "story.published"
  | "project.published"
  | "security.oauth.authorized"
  | "security.pat.created"
  | (string & {});

export type StorytellerNotificationFilter = "all" | "unread" | "locked";

export interface StorytellerNotificationStory {
  public_id: string;
  title: string;
  word_count: number;
  volume_title?: string;
}

export interface StorytellerNotificationPayload {
  // 通用欄位：title／body 所有類型都必填（純文字、保留換行）；link 選填，只接受站內路徑
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
}

export interface StorytellerNotification {
  public_id: string;
  kind: StorytellerNotificationKind;
  payload: StorytellerNotificationPayload;
  read: boolean;
  locked: boolean;
  // null 代表已鎖定、不會被保留期清除
  expires_at: string | null;
  created_at: string;
}

export interface StorytellerNotificationPage {
  items: StorytellerNotification[];
  next_cursor: string;
  unread_count: number;
  locked_count: number;
  lock_limit: number;
}
