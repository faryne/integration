import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerWorkspaceSearchKind,
  StorytellerWorkspaceSearchResult,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 對應後端 workspaceSearchKeywordLimit；側欄與對話框輸入框共用同一個上限。
export const STORYTELLER_WORKSPACE_SEARCH_KEYWORD_LIMIT = 100;

export function useStorytellerWorkspaceSearch(
  projectPublicId?: string,
  keyword = "",
  kind?: StorytellerWorkspaceSearchKind,
) {
  const { session } = useAuth();
  const normalizedKeyword = keyword.trim();
  return useQuery({
    queryKey: [
      "storyteller",
      "workspace-search",
      projectPublicId,
      normalizedKeyword,
      kind,
      session?.user.id,
    ],
    enabled: Boolean(
      session?.encrypt_key && projectPublicId && normalizedKeyword,
    ),
    staleTime: 15_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerWorkspaceSearchResult[]>
      >(`${apiBase}/storyteller/projects/${projectPublicId}/search`, {
        params: { keyword: normalizedKeyword, kind },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data ?? [];
    },
  });
}
