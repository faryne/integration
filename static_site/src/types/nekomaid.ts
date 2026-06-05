export type NekomaidSite = "pixiv" | "nico" | "tinami" | string;

export interface NekomaidPhoto {
  description?: string;
  ext?: string;
  height?: number;
  mime?: string;
  width?: number;
  ratio?: number;
  thumb?: string;
  thumbnail?: string;
  url: string;
  raw?: string;
  original?: string;
}

export interface NekomaidAuthor {
  author_id?: string | number;
  nickname?: string;
  author?: string;
}

export interface NekomaidArtwork {
  id?: string | number;
  site?: NekomaidSite;
  from?: NekomaidSite;
  artwork_id: string;
  author_id: string | number;
  title: string;
  tags: string[];
  thumb?: string;
  photos: NekomaidPhoto[];
  photos_cnt?: number;
  gif?: boolean | number;
  is_animated?: boolean | number;
  type?: string;
  r18?: boolean;
  is_r18?: boolean | number;
  published_dt?: number;
  artwork_page?: string;
  author_page?: string;
  nekomaid_link?: string;
}

export interface NekomaidSearchResponse {
  artworks?: NekomaidArtwork[];
  items?: NekomaidArtwork[];
  author?: NekomaidAuthor;
  next_token?: string;
  total?: number;
  relative_tags?: string[];
}

export interface NekomaidArtworkDetailResponse {
  artwork: NekomaidArtwork;
  author?: NekomaidAuthor;
  recommendations: NekomaidArtwork[];
}

export interface NekomaidSearchRequest {
  site?: string;
  authorId?: string;
  tag?: string;
  sites?: string;
  rating?: string;
  type?: string;
  wallpaper?: string;
  min_width?: string;
  nextToken?: string;
}
