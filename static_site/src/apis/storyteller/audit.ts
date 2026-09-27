import axios from "axios";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import type { CommonResponse } from "@/apis/interfaces.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import type {
  StorytellerAuditArchiveFilters,
  StorytellerAuditArchiveMonths,
  StorytellerAuditArchiveQuery,
  StorytellerAuditArchiveResults,
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

export function useStorytellerAuditArchiveMonths(projectPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "audit-archive-months",
      projectPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && projectPublicId),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditArchiveMonths>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/audit-archive-months`,
        {
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return response.data.data;
    },
  });
}

export function useCreateStorytellerAuditArchiveQuery(
  projectPublicId?: string,
) {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      month_from: string;
      month_to: string;
      filters: StorytellerAuditArchiveFilters;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerAuditArchiveQuery>
      >(
        `${apiBase}/storyteller/projects/${projectPublicId}/audit-archive-queries`,
        input,
        { headers: sessionHeaders(session!.encrypt_key) },
      );
      return response.data.data;
    },
  });
}

// 封存查詢在 Athena 背景執行；排隊中或執行中時依後端建議的間隔輪詢，完成或失敗就停止。
export function useStorytellerAuditArchiveQuery(queryPublicId?: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: [
      "storyteller",
      "audit-archive-query",
      queryPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && queryPublicId),
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditArchiveQuery>
      >(`${apiBase}/storyteller/audit-archive-queries/${queryPublicId}`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
    refetchInterval: (query) => {
      const job = query.state.data;
      return job && (job.status === "queued" || job.status === "running")
        ? job.poll_after_ms
        : false;
    },
  });
}

export function useStorytellerAuditArchiveResults(
  queryPublicId: string | undefined,
  enabled: boolean,
) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      "storyteller",
      "audit-archive-results",
      queryPublicId,
      session?.user.id,
    ],
    enabled: Boolean(session?.encrypt_key && queryPublicId && enabled),
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditArchiveResults>
      >(
        `${apiBase}/storyteller/audit-archive-queries/${queryPublicId}/results`,
        {
          params: { cursor: pageParam || undefined },
          headers: sessionHeaders(session!.encrypt_key),
        },
      );
      return response.data.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.next_cursor : undefined,
  });
}
