import {
  Alert,
  Card,
  CardActionArea,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { isSteamLoomSite } from "@/helpers/steamloom.ts";
import {
  availableAuthMethods,
  mcpAuthMeta,
  mcpServices,
  type McpAuthMethod,
  type McpService,
} from "@/pages/storyteller/mcpClientSetup.ts";

// 步驟 1、2 共用的選項卡片：選中時加主色外框，不能選時降低透明度。
function OptionCard({
  title,
  description,
  selected,
  disabled = false,
  chip,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  chip?: string;
  onClick?: () => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        borderColor: selected ? "primary.main" : undefined,
        boxShadow: selected
          ? (theme) => `inset 0 0 0 1px ${theme.palette.primary.main}`
          : undefined,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <CardActionArea
        disabled={disabled || !onClick}
        onClick={onClick}
        sx={{ height: "100%", p: 1.5, alignItems: "flex-start" }}
      >
        <Stack spacing={0.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography fontWeight={800}>{title}</Typography>
            {chip && <Chip size="small" color="primary" label={chip} />}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

// 步驟 1：選 AI 服務。faryne.dev 網域沒有 OAuth，只支援 OAuth 的服務反灰並提示改到 steamloom.works。
export function McpServicePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (service: McpService) => void;
}) {
  return (
    <Grid container spacing={1.5}>
      {mcpServices.map((service) => {
        const blocked = availableAuthMethods(service).length === 0;
        return (
          <Grid key={service.key} size={{ xs: 6, md: 4 }}>
            <OptionCard
              title={service.label}
              description={
                blocked
                  ? "需要 OAuth，請到 steamloom.works 設定"
                  : service.description
              }
              selected={value === service.key}
              disabled={blocked}
              onClick={() => onChange(service)}
            />
          </Grid>
        );
      })}
    </Grid>
  );
}

// 步驟 2：只列出這個服務支援的授權方式；只有一種時直接帶入（由 McpPanel 決定），這裡顯示原因。
export function McpAuthPicker({
  service,
  value,
  onChange,
}: {
  service: McpService;
  value: McpAuthMethod | null;
  onChange: (method: McpAuthMethod) => void;
}) {
  const methods = availableAuthMethods(service);
  if (methods.length === 1) {
    const reason = isSteamLoomSite()
      ? service.oauthOnlyReason
      : "OAuth 只在 steamloom.works 開放，faryne.dev 的 MCP 位址只能用 Personal Access Token。";
    return (
      <Stack spacing={1}>
        <OptionCard
          title={mcpAuthMeta[methods[0]].label}
          description={mcpAuthMeta[methods[0]].description}
          selected
        />
        {reason && (
          <Alert severity="info" variant="outlined">
            {reason}
          </Alert>
        )}
      </Stack>
    );
  }
  return (
    <Grid container spacing={1.5}>
      {methods.map((method, index) => (
        <Grid key={method} size={{ xs: 12, md: 6 }}>
          <OptionCard
            title={mcpAuthMeta[method].label}
            description={mcpAuthMeta[method].description}
            chip={index === 0 ? "推薦" : undefined}
            selected={value === method}
            onClick={() => onChange(method)}
          />
        </Grid>
      ))}
    </Grid>
  );
}
