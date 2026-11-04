import { Box, Divider, Link, Stack, Typography } from "@mui/material";
import type { ActressLink } from "@/types/av.ts";
import { linkLabel } from "@/helpers/referenceLink.ts";

/** 影片詳細頁「基本資料」最後一列「連結」：核准過的參考連結；沒有連結就不顯示（欄寬同其他資料列） */
export function VideoLinksRow({
  links,
  divider,
}: {
  links?: ActressLink[] | null;
  divider: boolean;
}) {
  if (!links?.length) return null;
  return (
    <Box>
      {divider && <Divider />}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "64px 1fr", sm: "96px 1fr" },
          gap: { xs: 1, sm: 2 },
          alignItems: "start",
          px: { xs: 2, md: 2.5 },
          py: 1.75,
          textAlign: "left",
        }}
      >
        <Typography color="text.secondary" fontWeight={700}>
          連結
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={2}>
          {links.map((link) => (
            <Link
              href={link.url}
              key={link.url}
              rel="noopener noreferrer nofollow"
              sx={{ wordBreak: "break-all" }}
              target="_blank"
              underline="hover"
            >
              {linkLabel(link)}
            </Link>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
