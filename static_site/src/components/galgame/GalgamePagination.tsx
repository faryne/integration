import { Pagination } from "@mui/material";

import { useGalgamePage } from "@/helpers/galgameTimeFilter.ts";

/** 依總筆數顯示分頁，頁碼寫在網址 ?page=（可分享、可被搜尋引擎爬到）；只有一頁時不顯示 */
export function GalgamePagination({
  total,
  perPage,
}: {
  total: number;
  perPage: number;
}) {
  const { page, setPage } = useGalgamePage();
  const count = Math.ceil(total / (perPage || 1));
  if (count <= 1) {
    return null;
  }
  return (
    <Pagination
      page={page}
      count={count}
      onChange={(_, value) => setPage(value)}
      sx={{ alignSelf: "center", mt: 3 }}
    />
  );
}
