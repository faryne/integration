import { createStorytellerTheme, storytellerGlobalStyles } from "@steamloom-web/data/storytellerMuiTheme.ts";
import { Box, CircularProgress, CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { AboutDialog } from "@writer/components/AboutDialog.tsx";
import { AppHeader } from "@writer/components/AppHeader.tsx";
import { SnackProvider, useSnack } from "@writer/components/SnackProvider.tsx";
import { UpdateDialog } from "@writer/components/UpdateDialog.tsx";
import { backend, errorMessage, isNotLoggedIn, type Profile, type Project, type UpdateInfo } from "@writer/lib/backend.ts";
import { SessionExpiredContext } from "@writer/lib/useBackendData.ts";
import { WebApiProvider } from "@writer/lib/webApi.tsx";
import { LoadErrorPage } from "@writer/pages/LoadErrorPage.tsx";
import { LoginPage } from "@writer/pages/LoginPage.tsx";
import { ProjectsPage } from "@writer/pages/ProjectsPage.tsx";
import { WorkerSettingsPage } from "@writer/pages/settings/WorkerSettingsPage.tsx";
import { WorkspacePage } from "@writer/pages/workspace/WorkspacePage.tsx";

// 外觀先固定 nocturne（網站預設的深色），之後要切換再接網站的 appearance 設定
const theme = createStorytellerTheme("nocturne");
const globalStyles = storytellerGlobalStyles("nocturne");

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles styles={globalStyles} />
      <SnackProvider>
        <Shell />
      </SnackProvider>
    </ThemeProvider>
  );
}

// undefined＝正在載入；null＝未登入；"error"＝有憑證但載入作者資料失敗
function Shell() {
  const { t } = useTranslation();
  const { showError } = useSnack();
  const [profile, setProfile] = useState<Profile | null | "error" | undefined>(undefined);
  // 目前打開的專案；null 時顯示專案列表
  const [openProject, setOpenProject] = useState<Project | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("dev");

  // 啟動時與授權完成後共用：只有 not_logged_in 才回登入頁，其他錯誤（離線、站台錯誤）給重試
  const loadProfile = useCallback(() => {
    setProfile(undefined);
    backend
      .Me()
      .then(setProfile)
      .catch((err) => {
        if (isNotLoggedIn(err)) return setProfile(null);
        showError(errorMessage(err));
        setProfile("error");
      });
  }, [showError]);

  useEffect(loadProfile, [loadProfile]);

  // 啟動與 About 共用同一條檢查流程；找到新版時一律交給 UpdateDialog 詢問。
  const checkForUpdate = useCallback(() =>
    backend.CheckForUpdate()
      .then((info) => {
        setUpdate(info);
        return info !== null;
      })
      .catch((err) => {
        showError(errorMessage(err));
        throw err;
      }), [showError]);

  useEffect(() => {
    void checkForUpdate().catch(() => undefined);
  }, [checkForUpdate]);

  useEffect(() => {
    backend.AppVersion().then(setAppVersion).catch((err) => showError(errorMessage(err)));
    return EventsOn("app:show-about", () => setAboutOpen(true));
  }, [showError]);

  // 呼叫 API 時發現授權失效（過期或在網站上被撤銷）
  const handleSessionExpired = useCallback(() => {
    setProfile(null);
    setOpenProject(null);
    setSettingsOpen(false);
    showError(t("auth.sessionExpired"));
  }, [showError, t]);

  const logout = () =>
    backend
      .Logout()
      .catch((err) => showError(errorMessage(err)))
      .finally(() => {
        setProfile(null);
        setOpenProject(null);
        setSettingsOpen(false);
      });

  const installUpdate = () =>
    backend.InstallUpdate().catch((err) => {
      showError(errorMessage(err));
      throw err;
    });

  return (
    <SessionExpiredContext.Provider value={handleSessionExpired}>
      <Box sx={{ height: "100vh", display: "flex", flexDirection: "column" }}>
        <AppHeader profile={typeof profile === "object" ? profile : null} settingsActive={settingsOpen} onSettings={() => setSettingsOpen(true)} onLogout={logout} />
        {profile === undefined ? (
          <Box sx={{ flex: 1, display: "grid", placeItems: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : profile === null ? (
          <LoginPage onLoggedIn={loadProfile} />
        ) : profile === "error" ? (
          <LoadErrorPage onRetry={loadProfile} onLogout={logout} />
        ) : (
          <WebApiProvider onExpired={handleSessionExpired}>
            {settingsOpen ? (
              <WorkerSettingsPage rootLabel={openProject?.name ?? t("projects.title")} onBack={() => setSettingsOpen(false)} />
            ) : openProject ? (
              <WorkspacePage key={openProject.public_id} project={openProject} profile={profile} onBack={() => setOpenProject(null)} />
            ) : (
              <ProjectsPage onOpen={setOpenProject} />
            )}
          </WebApiProvider>
        )}
        <UpdateDialog info={update} onLater={() => setUpdate(null)} onInstall={installUpdate} />
        <AboutDialog open={aboutOpen} version={appVersion} onClose={() => setAboutOpen(false)} onCheckForUpdate={checkForUpdate} />
      </Box>
    </SessionExpiredContext.Provider>
  );
}
