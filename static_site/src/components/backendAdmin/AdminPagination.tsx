import { Pagination } from "@mui/material";

/** 後台列表的分頁：沒有資料時不顯示；perPage 以後端回傳為準，沒給才用預設值 */
export function AdminPagination({
  total = 0,
  perPage,
  page,
  onChange,
}: {
  total?: number;
  perPage: number;
  page: number;
  onChange: (page: number) => void;
}) {
  if (total <= 0) return null;
  return (
    <Pagination
      count={Math.max(1, Math.ceil(total / perPage))}
      onChange={(_, value) => onChange(value)}
      page={page}
      sx={{ alignSelf: "center" }}
    />
  );
}
