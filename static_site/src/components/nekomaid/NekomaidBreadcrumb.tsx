import { Box, Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { CopyrightClaimIcon } from "@/components/nekomaid/CopyrightClaimIcon.tsx";
import { nekomaidPath, siteLabels } from "@/helpers/nekomaid.ts";

// 麵包屑項目與後面的版權申告小旗子排在同一行
const itemWithClaimSx = { alignItems: "center", display: "inline-flex" };

export function NekomaidBreadcrumb({
  site,
  authorId,
  authorName,
  title,
  artworkId,
  claimable = false,
}: {
  site?: string;
  authorId?: string | number;
  authorName?: string;
  title?: string;
  artworkId?: string | number;
  /** 作品頁才開：畫師名稱旁申告整個畫師、作品名稱旁申告這件作品 */
  claimable?: boolean;
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
        <Link component={RouterLink} to={nekomaidPath()} underline="hover">
          難以名狀的抓圖器
        </Link>
        {cleanSite && (
          <Link
            component={RouterLink}
            to={nekomaidPath(encodeURIComponent(cleanSite))}
            underline="hover"
          >
            {siteLabels[cleanSite] ?? cleanSite}
          </Link>
        )}
        {cleanSite && cleanAuthorId && (
          <Box sx={itemWithClaimSx}>
            <Link
              component={RouterLink}
              to={nekomaidPath(
                `${encodeURIComponent(cleanSite)}/${encodeURIComponent(cleanAuthorId)}`,
              )}
              underline="hover"
            >
              {authorLabel}
            </Link>
            {claimable && (
              <CopyrightClaimIcon
                authorId={cleanAuthorId}
                label={authorLabel}
                site={cleanSite}
              />
            )}
          </Box>
        )}
        {cleanSite && cleanAuthorId && cleanArtworkId && (
          <Box sx={itemWithClaimSx}>
            <Typography color="text.primary" fontWeight={800}>
              {title || cleanArtworkId}
            </Typography>
            {claimable && (
              <CopyrightClaimIcon
                artworkId={cleanArtworkId}
                authorId={cleanAuthorId}
                label={title || cleanArtworkId}
                site={cleanSite}
              />
            )}
          </Box>
        )}
      </Breadcrumbs>
    </Box>
  );
}
