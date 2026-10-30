import { Card, CardContent, Link, Stack, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { ActressLink } from "@/types/av.ts";
import { linkHost, linkLabel } from "@/helpers/avActressFields.ts";

/** 女優頁「連結」區塊：上稿核准的參考連結；沒有連結就不顯示 */
export function ActressLinksCard({ links }: { links?: ActressLink[] | null }) {
  if (!links?.length) return null;
  return (
    <Card>
      <CardContent>
        <Stack spacing={1}>
          <Typography fontWeight={900}>連結</Typography>
          {links.map((link) => (
            <Link
              href={link.url}
              key={link.url}
              rel="noopener noreferrer nofollow"
              sx={{
                alignItems: "center",
                display: "flex",
                gap: 1,
                textAlign: "left",
                wordBreak: "break-all",
              }}
              target="_blank"
              underline="hover"
            >
              <OpenInNewIcon sx={{ fontSize: 16 }} />
              {linkLabel(link)}
              {link.title && (
                <Typography
                  color="text.secondary"
                  component="span"
                  sx={{ fontSize: 11, ml: "auto", whiteSpace: "nowrap" }}
                >
                  {linkHost(link.url)}
                </Typography>
              )}
            </Link>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
