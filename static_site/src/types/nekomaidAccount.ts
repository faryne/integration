import type { NekomaidArtwork } from "@/types/nekomaid.ts";

// neko 帳號與追蹤的型別（後端 model/entity/nekomaid/user.go）

/** 登入表單：login 是帳號或 email；new_password／new_email 只在舊會員搬家遇到例外時才帶 */
export interface NekomaidLoginRequest {
  login: string;
  password: string;
  new_password?: string;
  new_email?: string;
}

/** 目前登入者 */
export interface NekomaidAccount {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
  /** 未驗證時：超過這個時間帳號就會被清除 */
  verification_deadline: string | null;
}

/** 信件連結處理結果；merged 是驗證成功時一起併進來的舊帳號 */
export interface NekomaidActionResult {
  email: string;
  merged: string[];
}

/** 收藏 key：畫師 "site/author"、作品 "site/author/artwork"、標籤原字 */
export interface NekomaidFavoriteKeys {
  authors: string[];
  artworks: string[];
  tags: string[];
}

/** 我的追蹤 → 標籤 */
export interface NekomaidFavoriteTag {
  tag: string;
  created_on: string | null;
  artworks: NekomaidArtwork[];
}

/** 我的追蹤 → 畫師 */
export interface NekomaidFavoriteAuthor {
  site: string;
  author_id: string;
  nickname: string;
  created_on: string | null;
  artworks: NekomaidArtwork[];
}
