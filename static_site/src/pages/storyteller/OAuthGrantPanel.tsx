import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import {
  Alert,
  Avatar,
  Button,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { StorytellerMascotDialog } from "@/components/storyteller/StorytellerMascotDialog.tsx";
import { steamloomPath } from "@/helpers/steamloom.ts";
import {
  useRevokeStorytellerOAuthGrant,
  useStorytellerOAuthGrants,
} from "@/apis/storyteller.ts";
import type { StorytellerOAuthGrant } from "@/types/storyteller.ts";

// 「開發者 › OAuth Token」分頁：列出透過 OAuth 授權連線的應用程式，可逐一撤銷。
// 目前授權不分範圍（scope 之後再做），所以頁面最上方要講清楚應用程式能動到什麼。
export function StorytellerOAuthGrantPanel() {
  const { t } = useTranslation();
  const { data: grants = [], isLoading } = useStorytellerOAuthGrants();
  const revokeGrant = useRevokeStorytellerOAuthGrant();
  const [revoking, setRevoking] = useState<StorytellerOAuthGrant | null>(null);
  const [revoked, setRevoked] = useState(false);

  return (
    <Stack spacing={3}>
      <Alert severity="warning" variant="outlined">
        <Trans
          i18nKey="web.developer.oauth.scopeWarning"
          components={{ strong: <strong /> }}
        />
      </Alert>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack sx={{ p: { xs: 2, md: 3 } }} spacing={1}>
          <Typography variant="h6">
            {t("web.developer.oauth.listTitle")}
          </Typography>
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : grants.length === 0 ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <VerifiedUserOutlinedIcon color="primary" fontSize="large" />
              <Typography fontWeight={800}>
                {t("web.developer.oauth.emptyTitle")}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                {t("web.developer.oauth.emptyDescription")}
              </Typography>
              <Button
                component={RouterLink}
                to={steamloomPath("my/mcp")}
                variant="outlined"
                size="small"
              >
                {t("web.developer.viewConnectGuide")}
              </Button>
            </Stack>
          ) : (
            <List disablePadding>
              {grants.map((grant, index) => (
                <Stack key={grant.public_id}>
                  {index > 0 && <Divider component="li" />}
                  <OAuthGrantRow
                    grant={grant}
                    disabled={revokeGrant.isPending}
                    onRevoke={() => setRevoking(grant)}
                  />
                </Stack>
              ))}
            </List>
          )}
        </Stack>
      </Paper>

      <StorytellerMascotDialog
        open={revoking !== null}
        state="danger"
        eyebrow={t("web.developer.oauth.revokeTitle")}
        title={t("web.developer.oauth.confirmRevokeTitle", {
          name: revoking?.client_name ?? "",
        })}
        description={t("web.developer.oauth.confirmRevokeDescription", {
          name: revoking?.client_name ?? t("web.developer.oauth.thisApp"),
        })}
        onClose={() => setRevoking(null)}
        actions={
          <>
            <Button onClick={() => setRevoking(null)}>
              {t("web.common.cancel")}
            </Button>
            <Button
              color="error"
              variant="contained"
              disabled={revokeGrant.isPending}
              onClick={() => {
                if (revoking) {
                  revokeGrant.mutate(revoking.public_id, {
                    onSuccess: () => setRevoked(true),
                  });
                }
                setRevoking(null);
              }}
            >
              {t("web.developer.oauth.revoke")}
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={revoked}
        message={t("web.developer.oauth.revoked")}
        onClose={() => setRevoked(false)}
      />
      <CustomSnackbar
        open={revokeGrant.isError}
        message={t("web.developer.oauth.errors.revoke")}
        severity="error"
        onClose={() => revokeGrant.reset()}
      />
    </Stack>
  );
}

function OAuthGrantRow({
  grant,
  disabled,
  onRevoke,
}: {
  grant: StorytellerOAuthGrant;
  disabled: boolean;
  onRevoke: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <ListItem
      secondaryAction={
        <Button
          color="error"
          variant="outlined"
          size="small"
          disabled={disabled}
          onClick={onRevoke}
        >
          {t("web.developer.oauth.revoke")}
        </Button>
      }
      sx={{ pr: 12 }}
    >
      <ListItemAvatar>
        <Avatar
          variant="rounded"
          sx={{ bgcolor: "secondary.main", fontWeight: 800 }}
        >
          {grant.client_name.slice(0, 1).toUpperCase()}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <span>{grant.client_name}</span>
            <Chip
              size="small"
              variant="outlined"
              label={t("web.developer.oauth.nameFromApp")}
            />
          </Stack>
        }
        secondary={
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            <span>
              {t("web.developer.oauth.redirectHost", {
                host: grant.redirect_host,
              })}
              ・
              {t("web.developer.oauth.grantedAt", {
                date: new Date(grant.created_at).toLocaleString(
                  i18n.resolvedLanguage,
                ),
              })}
            </span>
            <span>
              {grant.last_used_at
                ? t("web.developer.lastUsed", {
                    date: new Date(grant.last_used_at).toLocaleString(
                      i18n.resolvedLanguage,
                    ),
                  })
                : t("web.developer.neverUsed")}
              ・
              {t("web.developer.oauth.expiry", {
                date: new Date(grant.refresh_expires_at).toLocaleDateString(
                  i18n.resolvedLanguage,
                ),
              })}
            </span>
          </Stack>
        }
        slotProps={{
          primary: { component: "div" },
          secondary: { component: "div" },
        }}
      />
    </ListItem>
  );
}
