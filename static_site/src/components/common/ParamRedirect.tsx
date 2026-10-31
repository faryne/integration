import { Navigate, useLocation, useParams } from "react-router-dom";

/** 舊網址轉到新位置：to 用網址參數組新路徑，查詢字串（?status=…）原樣帶過去 */
export function ParamRedirect({
  to,
}: {
  to: (params: Readonly<Record<string, string | undefined>>) => string;
}) {
  const params = useParams();
  const { search } = useLocation();
  return <Navigate replace to={`${to(params)}${search}`} />;
}
