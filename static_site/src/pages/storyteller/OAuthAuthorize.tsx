import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { CustomSnackbar } from "@/components/common/CustomSnackbar.tsx";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import type { StorytellerMascotPose } from "@/helpers/storytellerMascot.ts";
import { useTitle } from "@/helpers/title.tsx";
import {
  useStorytellerOAuthAuthorize,
  useStorytellerOAuthAuthorizePreview,
  useStorytellerUserProfile,
} from "@/apis/storyteller.ts";
import { OAuthAuthorizeMascotCard } from "@/pages/storyteller/OAuthAuthorizeMascotCard.tsx";
import { WorkspaceChrome } from "@/pages/storyteller/WorkspaceChrome.tsx";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import type { StorytellerOAuthAuthorizeParams } from "@/types/storyteller.ts";

const oauthParamKeys = [
  "response_type",
  "client_id",
  "redirect_uri",
  "code_challenge",
  "code_challenge_method",
  "state",
  "resource",
] as const;

// 授權卡片上的權限說明依現有 MCP tool 範圍列出；之後新增超出範圍的 tool 要同步更新。
const allowedScopes = [
  "讀取與修改你帳號下所有專案的作品、設定、資產",
  "管理你的作者檔案、讀寫梭梭的記憶",
  "建立、搬移與刪除上述內容",
];
const deniedScopes = [
  "變更帳號設定、刪除帳號",
  "查看或使用你的 Provider 金鑰、Personal Access Token 與其他授權",
];

function apiErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ||
      fallback
    );
  }
  return fallback;
}

// OAuth 授權同意頁（authorization_endpoint）。掛在 StorytellerLayout 底下，新使用者沒有
// 筆名時會先被 layout 的 PenNameDialog 擋住，填完才看得到授權卡片，整個流程不換頁。
export default function StorytellerOAuthAuthorize() {
  useTitle(`${STORYTELLER_APP_NAME} 授權連線`, { robots: "noindex, nofollow" });
  const [searchParams] = useSearchParams();
  const params = Object.fromEntries(
    oauthParamKeys.map((key) => [key, searchParams.get(key) ?? ""]),
  ) as unknown as StorytellerOAuthAuthorizeParams;
  const {
    session,
    loading: authLoading,
    login,
    logout,
    submitting,
  } = useAuth();
  const { data: profile } = useStorytellerUserProfile();
  const preview = useStorytellerOAuthAuthorizePreview(params);
  const authorize = useStorytellerOAuthAuthorize();
  const [redirecting, setRedirecting] = useState(false);
  const clientName = preview.data?.client_name ?? "應用程式";

  // client 正確但其他參數有誤：依 OAuth 規範直接把錯誤帶回應用程式
  const errorRedirectTo = preview.data?.error_redirect_to;
  useEffect(() => {
    if (errorRedirectTo) {
      setRedirecting(true);
      window.location.assign(errorRedirectTo);
    }
  }, [errorRedirectTo]);

  function decide(approve: boolean) {
    authorize.mutate(
      { ...params, approve },
      {
        onSuccess: (result) => {
          if (result?.redirect_to) {
            setRedirecting(true);
            window.location.assign(result.redirect_to);
          }
        },
      },
    );
  }

  // 梭梭的姿勢與台詞跟著狀態走；授權頁對使用者一律稱「您」
  const [pose, line]: [StorytellerMascotPose, string] = redirecting
    ? ["success", `好了，我送您回 ${clientName} 那邊。`]
    : preview.isError
      ? ["error", "這個請求對不上，我先不放行。請您回原本的工具重新連一次。"]
      : !session
        ? [
            "idle",
            `${clientName} 想來讀您的文字。請您先登入，我才知道要替誰開門。`,
          ]
        : ["thinking", "答應之後，它能讀、能改，也能刪。請您看清楚了再按。"];

  return (
    <WorkspaceChrome
      title="授權連線"
      titleDropdown={false}
      showHomeCrumb={false}
    >
      <Box sx={{ flex: 1, overflow: "auto", px: 2, py: { xs: 2, md: 5 } }}>
        <Stack alignItems="center">
          {preview.isLoading || authLoading ? (
            <CircularProgress size={28} sx={{ mt: 8 }} />
          ) : (
            <OAuthAuthorizeMascotCard pose={pose} line={line}>
              {redirecting ? (
                <Stack spacing={1.5}>
                  <Typography variant="h6" fontWeight={800}>
                    正在帶你回到 {clientName}…
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    如果沒有自動跳轉，請回到原本的分頁確認連線狀態。
                  </Typography>
                </Stack>
              ) : preview.isError ? (
                <Stack spacing={2} alignItems="flex-start">
                  <Typography variant="h6" fontWeight={800}>
                    這個授權請求無效
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    應用程式提供的 client_id
                    或跳轉網址不正確。為了你的帳號安全，我們不會把你導回該應用程式，請回到原本的工具重新連線。
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={steamloomPath()}
                    variant="outlined"
                  >
                    回到 {STORYTELLER_APP_NAME} 首頁
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <ClientChip name={clientName} />
                  <Typography variant="h6" fontWeight={800}>
                    {session
                      ? `${clientName} 想要連線到你的 ${STORYTELLER_APP_NAME} 帳號`
                      : "先登入，確認要授權的帳號"}
                  </Typography>
                  {!session ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        登入會以彈出視窗開啟，這個頁面不會離開。
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        disabled={submitting}
                        onClick={() => void login()}
                      >
                        {submitting ? "登入中" : "使用 Google 帳號登入"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <AccountLine
                        name={
                          profile?.pen_name ||
                          session.user.display_name ||
                          "（尚未設定筆名）"
                        }
                        email={session.user.email ?? ""}
                        onSwitch={() => void logout()}
                      />
                      <ScopeList />
                      <Box
                        sx={{
                          p: 1.25,
                          borderRadius: 1,
                          bgcolor: "action.hover",
                          textAlign: "center",
                          typography: "body2",
                        }}
                      >
                        授權後將跳轉到{" "}
                        <Box component="code" sx={{ fontWeight: 800 }}>
                          {preview.data?.redirect_host}
                        </Box>
                      </Box>
                      <Stack direction="row" spacing={1.5}>
                        <Button
                          fullWidth
                          variant="outlined"
                          disabled={authorize.isPending}
                          onClick={() => decide(false)}
                        >
                          拒絕
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={authorize.isPending}
                          onClick={() => decide(true)}
                        >
                          允許
                        </Button>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        textAlign="center"
                      >
                        之後可以在「開發者 › OAuth Token」隨時撤銷。
                      </Typography>
                    </>
                  )}
                </Stack>
              )}
            </OAuthAuthorizeMascotCard>
          )}
        </Stack>
      </Box>
      <CustomSnackbar
        open={authorize.isError}
        message={apiErrorMessage(authorize.error, "授權失敗，請稍後再試。")}
        severity="error"
        onClose={() => authorize.reset()}
      />
    </WorkspaceChrome>
  );
}

// client_name 是應用程式自己填的，旁邊一定要標註，避免使用者把它當成經過驗證的身分。
function ClientChip({ name }: { name: string }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      <Avatar
        variant="rounded"
        sx={{ width: 28, height: 28, fontSize: 14, bgcolor: "secondary.main" }}
      >
        {name.slice(0, 1).toUpperCase()}
      </Avatar>
      <Typography fontWeight={800}>{name}</Typography>
      <Chip size="small" variant="outlined" label="名稱由應用程式自行提供" />
    </Stack>
  );
}

// 「切換帳號」只負責登出：登入是 popup，登出後再自動開 popup 不算使用者手勢、容易被
// 瀏覽器擋，所以回到登入按鈕讓使用者自己點。
function AccountLine({
  name,
  email,
  onSwitch,
}: {
  name: string;
  email: string;
  onSwitch: () => void;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{
        p: 1.25,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        bgcolor: "action.hover",
      }}
    >
      <Avatar sx={{ width: 32, height: 32 }}>{name.slice(0, 1)}</Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={800} noWrap>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {email}
        </Typography>
      </Box>
      <Button size="small" onClick={onSwitch}>
        切換帳號
      </Button>
    </Stack>
  );
}

function ScopeList() {
  return (
    <Box
      sx={{
        p: 1.5,
        border: 1,
        borderColor: "divider",
        borderRadius: 1,
        typography: "body2",
        "& ul": { m: 0, mb: 1, pl: 2.5, lineHeight: 1.8 },
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        授權後，這個應用程式可以：
      </Typography>
      <ul>
        {allowedScopes.map((scope) => (
          <li key={scope}>{scope}</li>
        ))}
      </ul>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        不能：
      </Typography>
      <Box component="ul" sx={{ color: "text.secondary" }}>
        {deniedScopes.map((scope) => (
          <li key={scope}>{scope}</li>
        ))}
      </Box>
    </Box>
  );
}
