import type { EsPagination } from "@/apis/interfaces.ts";

export type NekomaidSite = "pixiv" | "nico" | "tinami" | string;

export interface NekomaidPhoto {
  description?: string;
  duration?: number;
  ext?: string;
  height?: number;
  metadataLines?: string[];
  mime?: string;
  width?: number;
  ratio?: number;
  size?: number;
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

export interface NekomaidSearchPayload {
  artworks?: NekomaidArtwork[];
  items?: NekomaidArtwork[];
  author?: NekomaidAuthor;
  relative_tags?: string[];
}

export type NekomaidSearchResponse = EsPagination<NekomaidSearchPayload>;

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
  cursor?: string;
}
