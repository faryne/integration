export interface GalgameBrand {
  id: number;
  public_id: string;
  name: string;
  youtube_channel_id: string;
  avatar_url: string;
  description: string;
  custom_url: string;
  subscriber_count: number;
  video_count: number;
  view_count: number;
  latest_video_count: number;
  status: "pending" | "approved" | "rejected";
  index_paused_at?: string | null;
  deleted_at?: string | null;
  links: Array<{ label: string; url: string }>;
}

export interface GalgameVideo {
  id: number;
  brand_id: number;
  brand_public_id: string;
  brand_name: string;
  brand_avatar_url: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string;
  description: string;
  published_at: string;
  duration_seconds: number;
  likes: number;
  dislikes: number;
  deleted_at?: string | null;
  tags?: string[] | null;
}

export interface GalgameVideoSearch {
  keyword?: string;
  published_at_from?: string;
  published_at_to?: string;
  page?: number;
  per_page?: number;
}

export interface GalgameFavoriteStatus {
  favorite: boolean;
}

export interface GalgameFavoriteStatuses {
  brand_ids: number[];
  video_ids: number[];
}

export interface GalgameVideoNavigation {
  previous: GalgameVideo | null;
  next: GalgameVideo | null;
}

export type GalgameVideoReactionAction =
  | "like"
  | "dislike"
  | "cancel_like"
  | "cancel_dislike";

export interface GalgameVideoReactionStatus {
  reaction: "" | "like" | "dislike";
  likes: number;
  dislikes: number;
}

export interface GalgameVideoSubmission {
  id: number;
  user_id: number;
  brand_id: number | null;
  youtube_channel_id: string;
  youtube_video_id: string;
  video_url: string;
  title: string;
  thumbnail_url: string;
  status: "pending" | "approved" | "rejected" | "failed";
  error_message: string;
  created_at: string;
}

export interface GalgameVideoTitleKeyword {
  id: number;
  keyword: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
