import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { AdminPagination } from "@/components/backendAdmin/AdminPagination.tsx";
import { AdminCardGrid } from "@/components/backendAdmin/galgame/GalgameAdminCards.tsx";
import { GalgameState } from "@/components/galgame/GalgameState.tsx";

export const GALGAME_ADMIN_PAGE_SIZE = 20;

interface PagedQuery<T> {
  isPending: boolean;
  isError: boolean;
  data?: { data: T[]; total: number; per_page: number };
}

/** galgame 管理頁的列表本體：載入中／讀取失敗／空狀態／卡片格線＋分頁，五個頁面共用 */
export function GalgameAdminList<T extends { id: number }>({
  query,
  loadingMessage,
  emptyMessage,
  page,
  onPageChange,
  renderItem,
}: {
  query: PagedQuery<T>;
  loadingMessage: string;
  emptyMessage: string;
  page: number;
  onPageChange: (page: number) => void;
  renderItem: (item: T) => ReactNode;
}) {
  const { t } = useTranslation();
  if (query.isError)
    return (
      <GalgameState message={t("galgame.admin.loadFailed")} severity="error" />
    );
  if (query.isPending) return <GalgameState loading message={loadingMessage} />;
  const rows = query.data?.data ?? [];
  if (rows.length === 0) return <GalgameState message={emptyMessage} />;
  return (
    <>
      <AdminCardGrid>{rows.map(renderItem)}</AdminCardGrid>
      <AdminPagination
        onChange={onPageChange}
        page={page}
        perPage={query.data?.per_page || GALGAME_ADMIN_PAGE_SIZE}
        total={query.data?.total}
      />
    </>
  );
}
