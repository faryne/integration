import { Breadcrumbs, Link, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { galgameBrandSlug } from "@/helpers/galgame.ts";

interface Props {
  brand?: { public_id: string; name: string };
  current?: string;
  videoTitle?: string;
}

export function GalgameBreadcrumb({ brand, current, videoTitle }: Props) {
  return (
    <Breadcrumbs aria-label="galgame breadcrumb" sx={{ mb: 3 }}>
      {brand || current || videoTitle ? (
        <Link component={RouterLink} to="/galgame" underline="hover">
          首頁
        </Link>
      ) : (
        <Typography color="text.primary">首頁</Typography>
      )}
      {brand &&
        (videoTitle ? (
          <Link
            component={RouterLink}
            to={`/galgame/${galgameBrandSlug(brand.public_id, brand.name)}`}
            underline="hover"
          >
            {brand.name}
          </Link>
        ) : (
          <Typography color="text.primary">{brand.name}</Typography>
        ))}
      {current && <Typography color="text.primary">{current}</Typography>}
      {videoTitle && (
        <Typography color="text.primary" noWrap sx={{ maxWidth: 520 }}>
          {videoTitle}
        </Typography>
      )}
    </Breadcrumbs>
  );
}
