export interface WebshotHistory {
  id: number;
  main_id: number;
  full_image_path: string;
  thumb_image_path: string;
  full_image_url: string;
  thumb_image_url: string;
  created_at: string;
}

export interface Webshot {
  id: number;
  url: string;
  url_hash: string;
  history: WebshotHistory[];
  history_current_page: number;
  history_last_page: number;
  history_per_page: number;
  history_total: number;
  created_at: string;
  updated_at: string;
}
