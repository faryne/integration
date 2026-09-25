import type { StorytellerAuthorIdentity } from "@/types/storyteller.ts";

type StorytellerAvatarPreference = Pick<
  StorytellerAuthorIdentity,
  "use_default_avatar" | "avatar_url"
>;

// AI 對話、個人檔案與頁首共用同一個優先順序，避免同頁出現不同頭像。
export function storytellerUserAvatarSrc(
  profile: StorytellerAvatarPreference | undefined,
  defaultAvatar: string | undefined,
) {
  const fallback = defaultAvatar?.trim() || undefined;
  return profile?.use_default_avatar === false
    ? profile.avatar_url?.trim() || fallback
    : fallback;
}
