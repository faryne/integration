import type { Pagination } from "@/apis/interfaces.ts";

// galgame 前台（catalog.ts）與管理後台（admin.ts）共用的 API 小工具
export const apiBase = import.meta.env.VITE_API_BASE;

/** 後端分頁的 data 可能是 null，統一補成空陣列 */
export function normalizePagination<T>(pagination: Pagination<T[]>) {
  return {
    ...pagination,
    data: pagination.data ?? [],
  };
}

/** 主站登入 session 的驗證 header */
export function sessionHeaders(encryptKey: string) {
  return { "X-Encrypt-Key": encryptKey };
}
