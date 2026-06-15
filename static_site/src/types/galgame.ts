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
}

export interface GalgameVideoSearch {
  keyword?: string;
  published_at_from?: string;
  published_at_to?: string;
  page?: number;
  per_page?: number;
}
