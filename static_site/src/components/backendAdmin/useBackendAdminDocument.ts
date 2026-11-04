import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { findBackendAdminNavMatch } from "@/data/backendAdminNav.ts";
import { useBreadcrumbTailValue } from "@/helpers/breadcrumbTail.ts";
import { setMetaByName } from "@/helpers/title.tsx";

/**
 * 後台的分頁標題與 robots：layout 用 SeoDisabledContext 關掉子頁的 useTitle（避免子頁把 robots 改回 index），
 * 改由這裡依側欄項目＋麵包屑最後一層組標題，並固定 noindex
 */
export function useBackendAdminDocument() {
  const { pathname } = useLocation();
  const tail = useBreadcrumbTailValue();
  const match = findBackendAdminNavMatch(pathname);
  const label = match?.item.label;
  useEffect(() => {
    document.title = [tail, label, "faryne.dev 後台"]
      .filter(Boolean)
      .join(" - ");
    setMetaByName("robots", "noindex, nofollow");
  }, [tail, label]);
}
