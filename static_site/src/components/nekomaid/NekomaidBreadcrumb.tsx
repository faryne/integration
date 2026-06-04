import { Box, Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { siteLabels } from "@/helpers/nekomaid.ts";

export function NekomaidBreadcrumb({
  site,
  authorId,
  authorName,
  title,
  artworkId,
}: {
  site?: string;
  authorId?: string | number;
  authorName?: string;
  title?: string;
  artworkId?: string | number;
}) {
  if (!site && !authorId && !artworkId) {
    return null;
  }

  const cleanSite = site ?? "";
  const cleanAuthorId = authorId === undefined ? "" : String(authorId);
  const cleanArtworkId = artworkId === undefined ? "" : String(artworkId);
  const authorLabel = authorName || cleanAuthorId;

  return (
    <Box sx={{ color: "text.secondary", fontSize: 14, minWidth: 0 }}>
      <Breadcrumbs aria-label="nekomaid breadcrumb">
        <Link component={RouterLink} to="/nekomaid" underline="hover">
          難以名狀的抓圖器
        </Link>
        {cleanSite && (
          <Link
            component={RouterLink}
            to={`/nekomaid/${encodeURIComponent(cleanSite)}`}
            underline="hover"
          >
            {siteLabels[cleanSite] ?? cleanSite}
          </Link>
        )}
        {cleanSite && cleanAuthorId && (
          <Link
            component={RouterLink}
            to={`/nekomaid/${encodeURIComponent(cleanSite)}/${encodeURIComponent(cleanAuthorId)}`}
            underline="hover"
          >
            {authorLabel}
          </Link>
        )}
        {cleanSite && cleanAuthorId && cleanArtworkId && (
          <Typography color="text.primary" fontWeight={800}>
            {title || cleanArtworkId}
          </Typography>
        )}
      </Breadcrumbs>
    </Box>
  );
}
