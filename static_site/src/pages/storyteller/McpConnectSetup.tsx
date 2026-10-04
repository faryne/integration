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
import { Link as RouterLink } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useCreateStorytellerPersonalAccessToken } from "@/apis/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { CopyableCode } from "@/pages/storyteller/developerShared.tsx";
import {
  mcpEndpoint,
  oauthMcpEndpoint,
  personalAccessTokenExpiryDays,
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
  return (
    <Stack spacing={1.5}>
      <Box component="ol" sx={{ m: 0, pl: 2.5, "& li + li": { mt: 1 } }}>
        {service.oauthSteps.map((step) => (
          <li key={step.text}>
            <Typography variant="body2">{step.text}</Typography>
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
        按下「允許」後就完成了，可以到{" "}
        <Link component={RouterLink} to={steamloomPath("my/oauth")}>
          OAuth Token 頁
        </Link>
        確認或撤銷。
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
  const createToken = useCreateStorytellerPersonalAccessToken();
  const [label, setLabel] = useState(service.label);
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
            這組 token
            只會顯示這一次，請馬上貼進設定；離開這一頁就無法再次查看完整內容。
          </Alert>
          <CopyableCode label="Token" value={token} onCopy={onCopy} />
          {service.pat && (
            <CopyableCode
              label={service.pat.snippetLabel}
              value={service.pat.snippet(mcpEndpoint, token)}
              onCopy={onCopy}
            />
          )}
          <Typography variant="body2" color="text.secondary">
            設定好後重新啟動工具即可連線；token 可以到{" "}
            <Link component={RouterLink} to={steamloomPath("my/pat")}>
              Personal Access Token 頁
            </Link>
            管理或撤銷。
          </Typography>
        </>
      ) : (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              required
              fullWidth
              size="small"
              label="名稱"
              placeholder="例如：Codex、我的筆電"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
            <TextField
              select
              size="small"
              label="效期"
              value={expiresIn}
              onChange={(event) => setExpiresIn(event.target.value)}
              sx={{ minWidth: 160 }}
            >
              {personalAccessTokenExpiryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={createToken.isPending || !label.trim()}
              onClick={create}
              sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
            >
              {createToken.isPending ? "建立中" : "建立 Token"}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            建立後會在這裡顯示 token 和 {service.label} 的設定方式。
          </Typography>
        </>
      )}
      <CustomSnackbar
        open={createToken.isError}
        message="建立 Token 失敗，請確認欄位內容後重試。"
        severity="error"
        onClose={() => createToken.reset()}
      />
    </Stack>
  );
}
