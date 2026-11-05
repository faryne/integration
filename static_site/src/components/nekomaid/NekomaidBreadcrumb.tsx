import type { ReactNode } from "react";
import { Box, Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { CopyrightClaimIcon } from "@/components/nekomaid/CopyrightClaimIcon.tsx";
import { nekomaidPath, siteLabels } from "@/helpers/nekomaid.ts";

// 麵包屑項目與後面的版權申告小旗子排在同一行
const itemWithClaimSx = { alignItems: "center", display: "inline-flex" };

/** neko 所有頁面共用的麵包屑外框與第一層（網站名稱），樣式一致：灰色分隔、連結 hover 底線、目前頁加粗 */
function BreadcrumbShell({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ color: "text.secondary", fontSize: 14, minWidth: 0 }}>
      <Breadcrumbs aria-label="nekomaid breadcrumb">
        <Link component={RouterLink} to={nekomaidPath()} underline="hover">
          難以名狀的抓圖器
        </Link>
        {children}
      </Breadcrumbs>
    </Box>
  );
}

/** 目前頁（最後一層）：加粗、主要文字色 */
function CurrentCrumb({ children }: { children: ReactNode }) {
  return (
    <Typography color="text.primary" fontWeight={800}>
      {children}
    </Typography>
  );
}

/**
 * 一般頁面（登入、我的追蹤、版權申告…）的麵包屑：items 依序排在網站名稱後面，
 * 有 to 的是連結、最後一項是目前頁。跟作品頁的 NekomaidBreadcrumb 共用同一個外框
 */
export function NekomaidPageBreadcrumb({
  items,
}: {
  items: { label: string; to?: string }[];
}) {
  return (
    <BreadcrumbShell>
      {items.map((item, index) =>
        item.to && index < items.length - 1 ? (
          <Link
            component={RouterLink}
            key={item.label}
            to={item.to}
            underline="hover"
          >
            {item.label}
          </Link>
        ) : (
          <CurrentCrumb key={item.label}>{item.label}</CurrentCrumb>
        ),
      )}
    </BreadcrumbShell>
  );
}

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
    <BreadcrumbShell>
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
          <CurrentCrumb>{title || cleanArtworkId}</CurrentCrumb>
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
    </BreadcrumbShell>
  );
}
