// VTuber 直播行事曆：對應後端 model/entity/opendata/vtuber/query.go

export type VtuberLiveStatus = "upcoming" | "live" | "ended" | "cancelled";
// OTHER：卒業生、holoAN、事務所スタッフ
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
  meta: string;
}
