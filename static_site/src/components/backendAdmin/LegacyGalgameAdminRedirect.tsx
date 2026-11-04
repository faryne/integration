import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { backendAdminUrl, galgameAdminPath } from "@/helpers/backendAdmin.ts";

/**
 * 舊的 galgame 管理入口（galgame.tv/admin、faryne.dev/galgame/admin）：
 * 同網域直接換路由，galgame.tv 要整頁轉到 faryne.dev（登入狀態存在各自網域，到那邊要再登入一次）
 */
export function LegacyGalgameAdminRedirect() {
  const path = galgameAdminPath("brands");
  const url = backendAdminUrl(path);
  useEffect(() => {
    if (url !== path) window.location.replace(url);
  }, [url, path]);
  return url === path ? <Navigate replace to={path} /> : null;
}
