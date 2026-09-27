import axios from "axios";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerAuditEventFilters,
  StorytellerAuditEventPage,
  StorytellerAuditEventQuery,
  StorytellerAuditScope,
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

const rangeHours: Record<StorytellerAuditEventQuery["range"], number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

// project scope 查單一專案；account scope 固定查登入者本人，後端不接受指定其他使用者。
function auditEndpoint(scope: StorytellerAuditScope, projectPublicId?: string) {
  return scope === "project"
    ? `${apiBase}/storyteller/projects/${projectPublicId}`
    : `${apiBase}/storyteller/account`;
}

export function useStorytellerAuditEvents(
  scope: StorytellerAuditScope,
  projectPublicId: string | undefined,
  query: StorytellerAuditEventQuery,
) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      "storyteller",
      "audit-events",
      scope,
      projectPublicId,
      query,
      session?.user.id,
    ],
    enabled: Boolean(
      session?.encrypt_key && (scope === "account" || projectPublicId),
    ),
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const from = new Date(
        Date.now() - rangeHours[query.range] * 3600 * 1000,
      ).toISOString();
      const response = await axios.get<
        CommonResponse<StorytellerAuditEventPage>
      >(`${auditEndpoint(scope, projectPublicId)}/audit-events`, {
        params: {
          cursor: pageParam || undefined,
          from,
          actor: query.actor || undefined,
          category: query.category || undefined,
          source: query.source || undefined,
          outcome: query.outcome || undefined,
          credential_ref: query.credentialRef || undefined,
          include_low_importance: query.includeLowImportance || undefined,
        },
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });
}

export function useStorytellerAuditEventFilters(
  scope: StorytellerAuditScope,
  projectPublicId?: string,
) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "audit-event-filters",
      scope,
      projectPublicId,
      session?.user.id,
    ],
    enabled: Boolean(
      session?.encrypt_key && (scope === "account" || projectPublicId),
    ),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditEventFilters>
      >(`${auditEndpoint(scope, projectPublicId)}/audit-event-filters`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
}
