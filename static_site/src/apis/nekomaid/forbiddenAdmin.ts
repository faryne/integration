import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAdminSession } from "@/apis/av/adminSession.ts";
import type { CommonResponse, Pagination } from "@/apis/interfaces.ts";
import type {
  CopyrightClaimAdminItem,
  CopyrightClaimStatus,
  NekomaidForbidden,
  NekomaidForbiddenCreateRequest,
  NekomaidForbiddenStatus,
} from "@/types/nekomaidForbidden.ts";

// 整合後台（/backend_admin/nekomaid/*）用的 API：禁抓名單與版權申告審核；只有管理者才會送出查詢
const adminBase = `${import.meta.env.VITE_API_BASE}/admin/nekomaid`;
export const NEKOMAID_ADMIN_PAGE_SIZE = 30;

const forbiddenKey = "nekomaid-admin-forbidden";
const claimKey = "nekomaid-admin-claims";

/** 後端分頁的 data 可能是 null，統一補成空陣列 */
function listPage<T>(data: Pagination<T[] | null>) {
  return { ...data, data: data.data ?? [] };
}

/** 禁抓名單列表 */
export function useNekomaidForbiddenList(filter: {
  site: string;
  keyword: string;
  status: NekomaidForbiddenStatus;
  page: number;
}) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [forbiddenKey, filter],
    enabled,
    retry: false,
    queryFn: async () =>
      listPage(
        (
          await axios.get<
            CommonResponse<Pagination<NekomaidForbidden[] | null>>
          >(`${adminBase}/forbidden`, {
            params: {
              site: filter.site || undefined,
              keyword: filter.keyword || undefined,
              status: filter.status || undefined,
              page: filter.page,
              per_page: NEKOMAID_ADMIN_PAGE_SIZE,
            },
            headers,
          })
        ).data.data,
      ),
  });
}

/** 新增禁抓；成功後由同步 job 在 5 分鐘內把作品從搜尋拉掉 */
export function useCreateNekomaidForbidden() {
  const { headers } = useAdminSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NekomaidForbiddenCreateRequest) =>
      (
        await axios.post<CommonResponse<NekomaidForbidden>>(
          `${adminBase}/forbidden`,
          input,
          { headers },
        )
      ).data.data,
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [forbiddenKey] }),
  });
}

/** 解除禁抓；同步 job 會把作品回補到搜尋 */
export function useDeleteNekomaidForbidden() {
  const { headers } = useAdminSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      axios.delete(`${adminBase}/forbidden/${id}`, { headers }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [forbiddenKey] }),
  });
}

const fetchClaims = (
  headers: Record<string, string> | undefined,
  filter: { status: CopyrightClaimStatus | ""; ip: string; page: number },
  perPage = NEKOMAID_ADMIN_PAGE_SIZE,
) =>
  axios
    .get<CommonResponse<Pagination<CopyrightClaimAdminItem[] | null>>>(
      `${adminBase}/forbidden-submissions`,
      {
        params: {
          status: filter.status || undefined,
          ip: filter.ip || undefined,
          page: filter.page,
          per_page: perPage,
        },
        headers,
      },
    )
    .then((r) => listPage(r.data.data));

/** 版權申告審核列表；ip 有值時只看同一來源的申告 */
export function useNekomaidClaimsAdmin(filter: {
  status: CopyrightClaimStatus | "";
  ip: string;
  page: number;
}) {
  const { enabled, headers } = useAdminSession();
  return useQuery({
    queryKey: [claimKey, "list", filter],
    enabled,
    retry: false,
    queryFn: () => fetchClaims(headers, filter),
  });
}

/** 待審申告數（後台側欄、總覽的提示用）：只拿 1 筆取 total */
export function usePendingNekomaidClaimCount(enabled: boolean) {
  const admin = useAdminSession();
  return useQuery({
    queryKey: [claimKey, "pending-count"],
    enabled: enabled && admin.enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: async () =>
      (
        await fetchClaims(
          admin.headers,
          { status: "pending", ip: "", page: 1 },
          1,
        )
      ).total,
  });
}

/** 核准／駁回申告；核准會寫進禁抓名單，所以兩邊列表一起更新 */
export function useReviewNekomaidClaim() {
  const { headers } = useAdminSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      approve,
      note,
    }: {
      id: number;
      approve: boolean;
      note: string;
    }) =>
      axios.put(
        `${adminBase}/forbidden-submissions/${id}/${approve ? "approve" : "reject"}`,
        { note },
        { headers },
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [claimKey] });
      void queryClient.invalidateQueries({ queryKey: [forbiddenKey] });
    },
  });
}
