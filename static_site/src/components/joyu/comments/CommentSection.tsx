import { useState } from "react";
import { Box, Pagination, Skeleton, Stack, Typography } from "@mui/material";

import { useComments } from "@/apis/av/joyu_comments.ts";

import { CommentComposer } from "./CommentComposer.tsx";
import { CommentThread } from "./CommentThread.tsx";

/**
 * 討論版（影片頁、女優頁共用）：最上面是留言輸入框，下面是頂層留言（新的在前）＋一層回覆，每頁 20 則。
 * target：video:番號（小寫）或 actress:domain:aid
 */
export function CommentSection({ target }: { target: string }) {
  const [page, setPage] = useState(1);
  const comments = useComments(target, page);
  const data = comments.data;
  const pageCount = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <Stack spacing={1.5} sx={{ textAlign: "left" }}>
      <CommentComposer target={target} onPosted={() => setPage(1)} />
      {comments.isPending && <Skeleton height={120} variant="rounded" />}
      {comments.isError && (
        <Typography color="error">留言讀取失敗，請稍後再試</Typography>
      )}
      <Box>
        {data?.data.map((c) => (
          <CommentThread key={c.id} comment={c} target={target} />
        ))}
      </Box>
      {pageCount > 1 && (
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Pagination
            count={pageCount}
            onChange={(_, p) => setPage(p)}
            page={page}
            shape="rounded"
            variant="outlined"
          />
        </Box>
      )}
    </Stack>
  );
}
