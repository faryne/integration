import AutoStoriesIcon from "@mui/icons-material/AutoStories";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  useStorytellerAgents,
  useStorytellerProjects,
} from "@/apis/storyteller.ts";
import { useAuth } from "@/components/auth/AuthContext.ts";
import { STORYTELLER_APP_NAME } from "@/data/storyteller.ts";
import { steamloomPath } from "@/helpers/steamloom.ts";
import { useTitle } from "@/helpers/title.tsx";
import { AgentCards, ProjectCards } from "@/pages/storyteller/HomeCards.tsx";
import {
  HomeMobileNav,
  HomeSidebar,
} from "@/pages/storyteller/HomeSidebar.tsx";
import {
  tabBreadcrumbLabel,
  tabPath,
  type StorytellerHomeTab,
} from "@/pages/storyteller/homeTabs.ts";
import { StorytellerAgentUsagePanel } from "@/pages/storyteller/AgentUsagePanel.tsx";
import { StorytellerApiKeyPanel } from "@/pages/storyteller/ApiKeyManagement.tsx";
import { StorytellerMcpPanel } from "@/pages/storyteller/McpPanel.tsx";
import { StorytellerLoading } from "@/pages/storyteller/StorytellerShell.tsx";
import StorytellerNewAgent from "@/pages/storyteller/NewAgent.tsx";
import StorytellerNewProject from "@/pages/storyteller/NewProject.tsx";
import {
  EditorBleedContainer,
  WorkspaceBleedContainer,
  WorkspaceCentered,
  WorkspaceChrome,
} from "@/pages/storyteller/WorkspaceChrome.tsx";

export default function StorytellerHome() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { session, loading, login, submitting } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } =
    useStorytellerProjects();
  const { data: agents = [], isLoading: agentsLoading } =
    useStorytellerAgents();

  // 建立/編輯專案／AI Agent 的表單路由跟列表頁共用同一個帳號工作台外殼——判斷方式
  // 比照 ProjectWorkspacePreview 的 routeEditorType：路徑本身就決定了要不要在
  // 右欄顯示表單，不用等資料載入完成才知道。
  const isProjectFormRoute =
    location.pathname.endsWith("/project/new") ||
    (location.pathname.includes("/project/") &&
      location.pathname.endsWith("/edit"));
  const isAgentFormRoute =
    location.pathname.endsWith("/agent/new") ||
    (location.pathname.includes("/agent/") &&
      location.pathname.endsWith("/edit"));
  const showBleedEditor = isProjectFormRoute || isAgentFormRoute;

  const activeTab: StorytellerHomeTab = location.pathname.includes("/agent")
    ? "agent"
    : location.pathname.includes("/api-keys")
      ? "apikey"
      : location.pathname.includes("/usage")
        ? "usage"
        : location.pathname.includes("/mcp")
          ? "mcp"
          : "project";

  const homeTitle = isProjectFormRoute
    ? `${params.id ? "編輯" : "建立"} ${STORYTELLER_APP_NAME} 專案`
    : isAgentFormRoute
      ? `${params.agentId ? "編輯" : "建立"} ${STORYTELLER_APP_NAME} AI Agent`
      : `${STORYTELLER_APP_NAME} 我的工作台`;
  useTitle(homeTitle, {
    path: location.pathname,
    robots: "noindex, nofollow",
  });

  function selectTab(tab: StorytellerHomeTab) {
    navigate(steamloomPath(`my/${tabPath[tab]}`));
  }

  function closeEmbeddedForm() {
    navigate(steamloomPath(isProjectFormRoute ? "my/project" : "my/agent"));
  }

  if (loading) {
    return (
      <WorkspaceChrome
        title="我的工作台"
        titleDropdown={false}
        showHomeCrumb={false}
      >
        <WorkspaceCentered>
          <CircularProgress size={24} />
          <Typography color="text.secondary">確認登入狀態...</Typography>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }
  if (!session) {
    return (
      <WorkspaceChrome
        title="我的工作台"
        titleDropdown={false}
        showHomeCrumb={false}
      >
        <WorkspaceCentered>
          <AutoStoriesIcon color="primary" />
          <Box>
            <Typography fontWeight={900}>需要登入</Typography>
            <Typography variant="body2" color="text.secondary">
              登入後即可查看我的工作台。
            </Typography>
          </Box>
          <Button variant="contained" onClick={() => void login()}>
            {submitting ? "登入中" : "使用 Google 登入"}
          </Button>
        </WorkspaceCentered>
      </WorkspaceChrome>
    );
  }

  return (
    <WorkspaceChrome
      title="我的工作台"
      titleDropdown={false}
      showHomeCrumb={false}
      trail={[tabBreadcrumbLabel[activeTab]]}
      action={
        !projectsLoading &&
        !agentsLoading && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" label={`${projects.length} 個創作專案`} />
            <Chip size="small" label={`${agents.length} 個 AI Agent`} />
          </Stack>
        )
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "260px minmax(0, 1fr)" },
          flex: 1,
          minHeight: 0,
          bgcolor: (theme) =>
            theme.palette.mode === "dark" ? "#191919" : "#ffffff",
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              borderRight: 1,
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "#2f2f2f" : "#e6e4df",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "#202020" : "#f7f7f5",
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            <HomeSidebar activeTab={activeTab} onSelect={selectTab} />
          </Box>
        )}
        <Box sx={{ minWidth: 0, overflow: "auto" }}>
          {isMobile && (
            <HomeMobileNav activeTab={activeTab} onSelect={selectTab} />
          )}
          {showBleedEditor ? (
            <EditorBleedContainer onBack={closeEmbeddedForm}>
              {isProjectFormRoute ? (
                <StorytellerNewProject embedded />
              ) : (
                <StorytellerNewAgent embedded />
              )}
            </EditorBleedContainer>
          ) : (
            <WorkspaceBleedContainer>
              <Stack spacing={2}>
                {activeTab === "project" || activeTab === "agent" ? (
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Typography variant="h6" fontWeight={800}>
                      {activeTab === "project"
                        ? "最近的創作專案"
                        : "可用的 AI Agent"}
                    </Typography>
                    <Button
                      component={RouterLink}
                      to={steamloomPath(
                        activeTab === "project"
                          ? "my/project/new"
                          : "my/agent/new",
                      )}
                      variant="contained"
                    >
                      {activeTab === "project" ? "建立專案" : "建立 AI Agent"}
                    </Button>
                  </Stack>
                ) : null}
                {activeTab === "project" && projectsLoading ? (
                  <StorytellerLoading label="正在載入創作專案..." />
                ) : activeTab === "project" ? (
                  <ProjectCards projects={projects} />
                ) : activeTab === "agent" && agentsLoading ? (
                  <StorytellerLoading label="正在載入 AI Agent..." />
                ) : activeTab === "agent" ? (
                  <AgentCards agents={agents} />
                ) : activeTab === "apikey" ? (
                  <StorytellerApiKeyPanel />
                ) : activeTab === "usage" ? (
                  <StorytellerAgentUsagePanel />
                ) : (
                  <StorytellerMcpPanel />
                )}
              </Stack>
            </WorkspaceBleedContainer>
          )}
        </Box>
      </Box>
    </WorkspaceChrome>
  );
}
