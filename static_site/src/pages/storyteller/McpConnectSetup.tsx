import {
  Alert,
  Box,
  Button,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useCreateStorytellerPersonalAccessToken } from "@/apis/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { CopyableCode } from "@/pages/storyteller/developerShared.tsx";
import {
  mcpEndpoint,
  oauthMcpEndpoint,
  personalAccessTokenExpiryDays,
  mcpTextParams,
  personalAccessTokenExpiryOptions,
  type McpAuthMethod,
  type McpService,
} from "@/pages/storyteller/mcpClientSetup.ts";

// 步驟 3：依「服務×授權方式」顯示連線步驟。換服務或授權方式時，呼叫端用 key 重新掛載，
// PAT 表單與剛建立的 token 會一起清掉，不會把 A 服務的 token 帶到 B 服務的設定裡。
export function McpConnectSetup({
  service,
  method,
  onCopy,
}: {
  service: McpService;
  method: McpAuthMethod;
  onCopy: (value: string) => void;
}) {
  return method === "oauth" ? (
    <OAuthSteps service={service} onCopy={onCopy} />
  ) : (
    <PatSetup service={service} onCopy={onCopy} />
  );
}

function OAuthSteps({
  service,
  onCopy,
}: {
  service: McpService;
  onCopy: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Stack spacing={1.5}>
      <Box component="ol" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 1 } }}>
        {service.oauthSteps.map((step) => (
          <li key={step.text}>
            <Typography variant="body2">
              {t(step.text, mcpTextParams)}
            </Typography>
            {step.code && (
              <Box sx={{ mt: 0.75 }}>
                <CopyableCode
                  value={step.code(oauthMcpEndpoint)}
                  onCopy={onCopy}
                />
              </Box>
            )}
          </li>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary">
        <Trans
          i18nKey="web.mcp.oauthDone"
          components={{
            link: (
              <Link component={RouterLink} to={steamloomPath("my/oauth")} />
            ),
          }}
        />
      </Typography>
    </Stack>
  );
}

// PAT：先填名稱與效期，建立後在原地顯示 token 與這個服務格式的設定。token 只出現這一次。
function PatSetup({
  service,
  onCopy,
}: {
  service: McpService;
  onCopy: (value: string) => void;
}) {
  const { t } = useTranslation();
  const createToken = useCreateStorytellerPersonalAccessToken();
  const [label, setLabel] = useState(() => t(service.label));
  const [expiresIn, setExpiresIn] = useState("30");
  const [token, setToken] = useState<string | null>(null);

  function create() {
    createToken.mutate(
      { label, expires_in_days: personalAccessTokenExpiryDays(expiresIn) },
      { onSuccess: (created) => setToken(created?.token ?? null) },
    );
  }

  return (
    <Stack spacing={2}>
      {token ? (
        <>
          <Alert severity="warning" variant="outlined">
            {t("web.mcp.patShowOnce")}
          </Alert>
          <CopyableCode label="Token" value={token} onCopy={onCopy} />
          {service.pat && (
            <CopyableCode
              label={t(service.pat.snippetLabel, mcpTextParams)}
              value={service.pat.snippet(mcpEndpoint, token)}
              onCopy={onCopy}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            <Trans
              i18nKey="web.mcp.patDone"
              components={{
                link: (
                  <Link component={RouterLink} to={steamloomPath("my/pat")} />
                ),
              }}
            />
          </Typography>
        </>
      ) : (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              required
              fullWidth
              size="small"
              label={t("web.developer.pat.name")}
              placeholder={t("web.developer.pat.namePlaceholder")}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <TextField
              select
              size="small"
              label={t("web.developer.pat.expiry")}
              value={expiresIn}
              onChange={(event) => setExpiresIn(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              {personalAccessTokenExpiryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {t(option.label, { count: option.days })}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={createToken.isPending || !label.trim()}
              onClick={create}
              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {createToken.isPending
                ? t("web.developer.pat.creating")
                : t("web.mcp.createToken")}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {t("web.mcp.patPending", { service: t(service.label) })}
          </Typography>
        </>
      )}
      <CustomSnackbar
        open={createToken.isError}
        message={t("web.developer.pat.errors.create")}
        severity="error"
        onClose={() => createToken.reset()}
      />
    </Stack>
  );
}
