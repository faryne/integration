import type { StorytellerAuthorIdentity } from "@/types/storyteller.ts";

export function formatAuthorNames(
  authors?: Array<StorytellerAuthorIdentity | string> | string | null,
): string {
  if (!authors) return "";
  if (typeof authors === "string") return authors;
  return authors
    .map((author) => (typeof author === "string" ? author : author.pen_name))
    .filter(Boolean)
    .join("、");
}

export const ACCOUNT_PROFILE_ID = 0;
