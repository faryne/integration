// VTuber 直播行事曆：對應後端 model/entity/opendata/vtuber/query.go

export type VtuberLiveStatus = "upcoming" | "live" | "ended" | "cancelled";
// OTHER：holoAN、事務所スタッフ
export type VtuberBranch = "JP" | "EN" | "ID" | "DEV_IS" | "OTHER";

export interface VtuberUnit {
  slug: string;
  name: string;
  branch: VtuberBranch;
}

export interface VtuberCalendarLinks {
  calendar_id: string;
  subscribe_url: string;
  embed_url: string;
  ics_url: string;
}

export interface VtuberChannelSummary {
  channel_id: string;
  handle: string;
  title: string;
  thumbnail_url: string;
  unit_slug: string;
  is_live: boolean;
  // 在官網卒業生分組裡；仍歸在原本的期別，頭像用虛線圓環標示
  is_graduated: boolean;
}

export interface VtuberChannelList {
  units: VtuberUnit[];
  channels: VtuberChannelSummary[];
}

export interface VtuberChannelDetail extends VtuberChannelSummary {
  unit: VtuberUnit | null;
  description: string;
  banner_url: string;
  trailer_video_id: string;
  channel_published_at: string | null;
  youtube_url: string;
  official_url: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
  subscriber_delta_7d: number | null;
  subscriber_delta_90d: number | null;
  calendar: VtuberCalendarLinks | null;
}

export interface VtuberStat {
  record_date: string;
  subscriber_count: number;
  view_count: number;
  video_count: number;
}

export interface VtuberLive {
  video_id: string;
  channel_id: string;
  channel_title: string;
  channel_handle: string;
  channel_thumbnail_url: string;
  title: string;
  thumbnail_url: string;
  status: VtuberLiveStatus;
  scheduled_start_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  concurrent_viewers: number | null;
  updated_at: string;
}

export interface VtuberLiveList {
  from: string;
  to: string;
  lives: VtuberLive[];
}

// 「所有影片」的分類：全部／直播存檔／一般影片／Shorts
export type VtuberVideoType = "all" | "live" | "video" | "short";

export interface VtuberVideo {
  video_id: string;
  title: string;
  thumbnail_url: string;
  published_at: string;
}

export interface VtuberVideoPage {
  videos: VtuberVideo[];
  next_page_token: string;
}

// 影片 modal 要顯示的內容：直播、存檔都轉成這個格式
export interface VtuberPlayingVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  channelThumbnailUrl: string;
  when: string; // 「10/24 10:00」或存檔的上傳日期
  status?: VtuberLiveStatus; // 存檔沒有狀態
  viewers?: number | null; // 直播中的同接人數
  startedAt?: string | null; // 實際開播時間：直播中算「已開播」、已結束算「直播」時長
  endedAt?: string | null;
  vertical?: boolean; // 短片：直式播放器
}

// 影片 modal 點開時才查的說明
export interface VtuberVideoDetail {
  video_id: string;
  title: string;
  description: string;
  thumbnail_url: string;
  published_at: string | null;
  channel_id: string;
  channel_title: string;
  channel_handle: string;
  channel_thumbnail_url: string;
  live: VtuberVideoLive | null; // 不是直播（或還沒偵測到）時為 null
}

export interface VtuberVideoLive {
  status: VtuberLiveStatus;
  scheduled_start_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  concurrent_viewers: number | null;
}
