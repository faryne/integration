import axios from "axios";
import dayjs from "dayjs";
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
} from "@/types/storyteller.ts";
import { apiBase, sessionHeaders } from "./shared.ts";

// 活動紀錄只查登入者本人；後端固定以 session 的使用者查詢，不接受指定其他使用者。
const accountEndpoint = `${apiBase}/storyteller/account`;

const rangeHours: Record<"24h" | "7d" | "30d", number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

// auditQueryTimeRange 在送出請求時才把時間範圍換成實際時間（避免 query key 每秒變動）；
// 自訂範圍以瀏覽器時區的整天計算，結束日當天也包含在內（to 是隔天 00:00，後端為不含）。
export function auditQueryTimeRange(query: StorytellerAuditEventQuery) {
  if (query.range === "custom") {
    return {
      from: dayjs(query.customFrom).startOf("day").toISOString(),
      to: dayjs(query.customTo).add(1, "day").startOf("day").toISOString(),
    };
  }
  return {
    from: dayjs().subtract(rangeHours[query.range], "hour").toISOString(),
    to: undefined,
  };
}

// enabled=false 用在自訂日期還不合法（例如早於近期範圍）時，先不送出請求。
export function useStorytellerAuditEvents(
  query: StorytellerAuditEventQuery,
  enabled = true,
) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: ["storyteller", "audit-events", query, session?.user.id],
    enabled: Boolean(session?.encrypt_key && enabled),
    initialPageParam: "",
    queryFn: async ({ pageParam }) => {
      const { from, to } = auditQueryTimeRange(query);
      const response = await axios.get<
        CommonResponse<StorytellerAuditEventPage>
      >(`${accountEndpoint}/audit-events`, {
        params: {
          cursor: pageParam || undefined,
          from,
          to,
          project_public_id: query.projectPublicId || undefined,
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

export function useStorytellerAuditEventFilters() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "audit-event-filters", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditEventFilters>
      >(`${accountEndpoint}/audit-event-filters`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
}

export function useStorytellerAuditArchiveMonths() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["storyteller", "audit-archive-months", session?.user.id],
    enabled: Boolean(session?.encrypt_key),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const response = await axios.get<
        CommonResponse<StorytellerAuditArchiveMonths>
      >(`${accountEndpoint}/audit-archive-months`, {
        headers: sessionHeaders(session!.encrypt_key),
      });
      return response.data.data;
    },
  });
}

export function useCreateStorytellerAuditArchiveQuery() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (input: {
      month_from: string;
      month_to: string;
      filters: StorytellerAuditArchiveFilters;
    }) => {
      const response = await axios.post<
        CommonResponse<StorytellerAuditArchiveQuery>
      >(`${accountEndpoint}/audit-archive-queries`, input, {
        headers: sessionHeaders(session!.encrypt_key),
      });
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
