import { Link, Stack } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ActressLink } from "@/types/av.ts";
import { linkLabel } from "@/helpers/referenceLink.ts";

/** 女優頁頂端的參考連結（上稿核准的連結），橫向排開；沒有連結就不顯示 */
export function ActressLinks({ links }: { links?: ActressLink[] | null }) {
  if (!links?.length) return null;
  return (
    <Stack direction="row" flexWrap="wrap" gap={2} useFlexGap>
      {links.map((link) => (
        <Link
          href={link.url}
          key={link.url}
          rel="noopener noreferrer nofollow"
          sx={{
            alignItems: "center",
            display: "inline-flex",
            fontSize: 14,
            gap: 0.5,
          }}
          target="_blank"
          underline="hover"
        >
          <OpenInNewIcon sx={{ fontSize: 14 }} />
          {linkLabel(link)}
        </Link>
      ))}
    </Stack>
  );
}
