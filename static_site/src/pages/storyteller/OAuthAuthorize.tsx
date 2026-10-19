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
import { useTranslation } from "react-i18next";
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
// 授權範圍說明：web.developer.authorize.scopes.allowed.* ／ denied.*
const allowedScopes = ["projects", "profile", "manage"];
const deniedScopes = ["account", "credentials"];

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
  const { t } = useTranslation();
  useTitle(
    t("web.developer.authorize.pageTitle", { appName: STORYTELLER_APP_NAME }),
    {
      robots: "noindex, nofollow",
    },
  );
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
  const clientName =
    preview.data?.client_name ?? t("web.developer.authorize.app");

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
    ? [
        "success",
        t("web.developer.authorize.mascot.redirecting", { name: clientName }),
      ]
    : preview.isError
      ? ["error", t("web.developer.authorize.mascot.invalid")]
      : !session
        ? [
            "idle",
            t("web.developer.authorize.mascot.login", { name: clientName }),
          ]
        : ["thinking", t("web.developer.authorize.mascot.confirm")];

  return (
    <WorkspaceChrome
      title={t("web.developer.authorize.title")}
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
                    {t("web.developer.authorize.redirecting", {
                      name: clientName,
                    })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("web.developer.authorize.redirectingHelp")}
                  </Typography>
                </Stack>
              ) : preview.isError ? (
                <Stack spacing={2} alignItems="flex-start">
                  <Typography variant="h6" fontWeight={800}>
                    {t("web.developer.authorize.invalidTitle")}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t("web.developer.authorize.invalidDescription")}
                  </Typography>
                  <Button
                    component={RouterLink}
                    to={steamloomPath()}
                    variant="outlined"
                  >
                    {t("web.developer.authorize.backHome", {
                      appName: STORYTELLER_APP_NAME,
                    })}
                  </Button>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <ClientChip name={clientName} />
                  <Typography variant="h6" fontWeight={800}>
                    {session
                      ? t("web.developer.authorize.requestTitle", {
                          name: clientName,
                          appName: STORYTELLER_APP_NAME,
                        })
                      : t("web.developer.authorize.loginTitle")}
                  </Typography>
                  {!session ? (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {t("web.developer.authorize.loginHelp")}
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        disabled={submitting}
                        onClick={() => void login()}
                      >
                        {submitting
                          ? t("web.home.loggingIn")
                          : t("web.home.googleLogin")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <AccountLine
                        name={
                          profile?.pen_name ||
                          session.user.display_name ||
                          t("web.developer.authorize.noPenName")
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
                        {t("web.developer.authorize.redirectTo")}{" "}
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
                          {t("web.developer.authorize.deny")}
                        </Button>
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={authorize.isPending}
                          onClick={() => decide(true)}
                        >
                          {t("web.developer.authorize.allow")}
                        </Button>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        textAlign="center"
                      >
                        {t("web.developer.authorize.revokeLater")}
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
        message={apiErrorMessage(
          authorize.error,
          t("web.developer.authorize.errors.authorize"),
        )}
        severity="error"
        onClose={() => authorize.reset()}
      />
    </WorkspaceChrome>
  );
}

// client_name 是應用程式自己填的，旁邊一定要標註，避免使用者把它當成經過驗證的身分。
function ClientChip({ name }: { name: string }) {
  const { t } = useTranslation();
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
      <Chip
        size="small"
        variant="outlined"
        label={t("web.developer.oauth.nameFromApp")}
      />
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
  const { t } = useTranslation();
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
        {t("web.developer.authorize.switchAccount")}
      </Button>
    </Stack>
  );
}

function ScopeList() {
  const { t } = useTranslation();
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
        {t("web.developer.authorize.scopes.allowedTitle")}
      </Typography>
      <ul>
        {allowedScopes.map((scope) => (
          <li key={scope}>
            {t(`web.developer.authorize.scopes.allowed.${scope}`)}
          </li>
        ))}
      </ul>
      <Typography variant="caption" color="text.secondary" fontWeight={800}>
        {t("web.developer.authorize.scopes.deniedTitle")}
      </Typography>
      <Box component="ul" sx={{ color: "text.secondary" }}>
        {deniedScopes.map((scope) => (
          <li key={scope}>
            {t(`web.developer.authorize.scopes.denied.${scope}`)}
          </li>
        ))}
      </Box>
    </Box>
  );
}
