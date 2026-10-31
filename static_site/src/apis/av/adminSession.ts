import { sessionHeaders } from "@/apis/storyteller/shared.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";

/**
 * 主站管理 API（/admin/av/*）的 session：管理者才 enabled，不是管理者時 query 不會打 API。
 * 上稿審核與女優主題管理共用
 */
export function useAdminSession() {
  const { session } = useAuth();
  return {
    enabled: Boolean(session?.encrypt_key && session.user.is_admin),
    headers: session ? sessionHeaders(session.encrypt_key) : undefined,
  };
}
