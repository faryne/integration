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
  const { data: grants = [], isLoading } = useStorytellerOAuthGrants();
  const revokeGrant = useRevokeStorytellerOAuthGrant();
  const [revoking, setRevoking] = useState<StorytellerOAuthGrant | null>(null);
  const [revoked, setRevoked] = useState(false);

  return (
    <Stack spacing={3}>
      <Alert severity="warning" variant="outlined">
        <strong>目前授權不分範圍。</strong>
        已授權的應用程式可以讀取與修改你帳號下所有專案（作品、設定、資產、作者檔案、梭梭的記憶），包含刪除。
      </Alert>

      <Paper variant="outlined" sx={{ borderRadius: 1 }}>
        <Stack sx={{ p: { xs: 2, md: 3 } }} spacing={1}>
          <Typography variant="h6">已授權的應用程式</Typography>
          {isLoading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : grants.length === 0 ? (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 4 }}>
              <VerifiedUserOutlinedIcon color="primary" fontSize="large" />
              <Typography fontWeight={800}>還沒有授權任何應用程式</Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                textAlign="center"
              >
                在 Claude.ai 或 ChatGPT 新增自訂 connector，貼上 MCP
                網址後就會出現在這裡。
              </Typography>
              <Button
                component={RouterLink}
                to={steamloomPath("my/mcp")}
                variant="outlined"
                size="small"
              >
                看連線方式
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
        eyebrow="撤銷授權"
        title={`確定要撤銷「${revoking?.client_name ?? ""}」？`}
        description={`撤銷後 ${revoking?.client_name ?? "這個應用程式"} 會立刻失去存取權限，需要重新授權才能再次連線。`}
        onClose={() => setRevoking(null)}
        actions={
          <>
            <Button onClick={() => setRevoking(null)}>取消</Button>
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
              撤銷
            </Button>
          </>
        }
      />
      <CustomSnackbar
        open={revoked}
        message="已撤銷授權"
        onClose={() => setRevoked(false)}
      />
      <CustomSnackbar
        open={revokeGrant.isError}
        message="撤銷授權失敗，請稍後再試。"
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
          撤銷
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
            <Chip size="small" variant="outlined" label="名稱由應用程式提供" />
          </Stack>
        }
        secondary={
          <Stack spacing={0.25} sx={{ mt: 0.25 }}>
            <span>
              跳轉網域 {grant.redirect_host}・授權於{" "}
              {new Date(grant.created_at).toLocaleString()}
            </span>
            <span>
              {grant.last_used_at
                ? `上次使用於 ${new Date(grant.last_used_at).toLocaleString()}`
                : "尚未使用過"}
              ・30 天未使用將自動失效（目前至{" "}
              {new Date(grant.refresh_expires_at).toLocaleDateString()}）
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
