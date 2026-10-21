import { Breadcrumbs, Link, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { galgameBrandSlug, galgamePath } from "@/helpers/galgame.ts";

interface Props {
  brand?: { public_id: string; name: string };
  current?: string;
  videoTitle?: string;
}

export function GalgameBreadcrumb({ brand, current, videoTitle }: Props) {
  const { t } = useTranslation();
  return (
    <Breadcrumbs aria-label={t("galgame.breadcrumb.ariaLabel")} sx={{ mb: 3 }}>
      {brand || current || videoTitle ? (
        <Link component={RouterLink} to={galgamePath()} underline="hover">
          {t("galgame.breadcrumb.home")}
        </Link>
      ) : (
        <Typography color="text.primary">
          {t("galgame.breadcrumb.home")}
        </Typography>
      )}
      {brand &&
        (videoTitle ? (
          <Link
            component={RouterLink}
            to={galgamePath(galgameBrandSlug(brand.public_id, brand.name))}
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
