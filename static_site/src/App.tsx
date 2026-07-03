import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { ModernLayout } from "./layouts/ModernLayout.tsx";
import { NekomaidLayout } from "./layouts/NekomaidLayout.tsx";
import { GalgameLayout } from "./layouts/GalgameLayout.tsx";
import { LabLayout } from "./layouts/LabLayout.tsx";
import { StorytellerLayout } from "./layouts/StorytellerLayout.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";
import { trackPageView } from "@/lib/analytics.ts";
import { isGalgameSite } from "@/helpers/galgame.ts";
import { isNekomaidSite } from "@/helpers/nekomaid.ts";

// const Home = lazy(() => import("@/pages/Home.tsx"));
const LabHome = lazy(() => import("@/pages/LabHome.tsx"));
const Cv = lazy(() => import("@/pages/Cv.tsx"));
const About = lazy(() => import("@/pages/About/index.tsx"));
const Login = lazy(() => import("@/pages/auth/Login.tsx"));
const EncryptedDemo = lazy(() => import("@/pages/auth/EncryptedDemo.tsx"));
const AVVideo = lazy(() =>
  import("@/pages/av/video.tsx").then((module) => ({
    default: module.AVVideo,
  })),
);
const AVActress = lazy(() =>
  import("@/pages/av/actress.tsx").then((module) => ({
    default: module.AVActress,
  })),
);
const AVActressDetail = lazy(() =>
  import("@/pages/av/actress_detail.tsx").then((module) => ({
    default: module.AVActressDetail,
  })),
);
const AVVideoDetail = lazy(() =>
  import("@/pages/av/video_detail.tsx").then((module) => ({
    default: module.AVVideoDetail,
  })),
);
const TwStatsIndex = lazy(() =>
  import("@/pages/opendata/twstats_index.tsx").then((module) => ({
    default: module.TwStatsIndex,
  })),
);
const TwStatsByName = lazy(() =>
  import("@/pages/opendata/twstats_byname.tsx").then((module) => ({
    default: module.TwStatsByName,
  })),
);
const FireDepartmentRealtime = lazy(() =>
  import("@/pages/opendata/firedepartment_realtime.tsx").then((module) => ({
    default: module.FireDepartmentRealtime,
  })),
);
const TaipowerNeighbor = lazy(
  () => import("@/pages/opendata/taipower_neighbor.tsx"),
);
const TaipowerNeighborMap = lazy(
  () => import("@/pages/opendata/taipower_neighbor_map.tsx"),
);
const TaipowerNeighborStatistics = lazy(
  () => import("@/pages/opendata/taipower_neighbor_statistics.tsx"),
);
const RatesIndex = lazy(() =>
  import("@/pages/opendata/rates_index.tsx").then((module) => ({
    default: module.RatesIndex,
  })),
);
const NCCC = lazy(() => import("@/pages/opendata/nccc.tsx"));
const Editor = lazy(() =>
  import("@/pages/storyteller/editor.tsx").then((module) => ({
    default: module.Editor,
  })),
);
const StorytellerPublicHome = lazy(
  () => import("@/pages/storyteller/PublicHome.tsx"),
);
const StorytellerHome = lazy(() => import("@/pages/storyteller/Home.tsx"));
const StorytellerFavorites = lazy(
  () => import("@/pages/storyteller/Favorites.tsx"),
);
const StorytellerProfile = lazy(
  () => import("@/pages/storyteller/Profile.tsx"),
);
const StorytellerProjectDetail = lazy(
  () => import("@/pages/storyteller/ProjectDetail.tsx"),
);
const StorytellerNewProject = lazy(
  () => import("@/pages/storyteller/NewProject.tsx"),
);
const StorytellerNewAgent = lazy(
  () => import("@/pages/storyteller/NewAgent.tsx"),
);
const StorytellerApiKeyManagement = lazy(
  () => import("@/pages/storyteller/ApiKeyManagement.tsx"),
);
const StorytellerAgentDiffCompare = lazy(
  () => import("@/pages/storyteller/AgentDiffCompare.tsx"),
);
const StorytellerStoryEditor = lazy(
  () => import("@/pages/storyteller/StoryEditor.tsx"),
);
const StorytellerLoreEditor = lazy(
  () => import("@/pages/storyteller/LoreEditor.tsx"),
);
const StorytellerStoryDiffCompare = lazy(
  () => import("@/pages/storyteller/StoryDiffCompare.tsx"),
);
const StorytellerLoreDiffCompare = lazy(
  () => import("@/pages/storyteller/LoreDiffCompare.tsx"),
);
const StorytellerReader = lazy(() => import("@/pages/storyteller/Reader.tsx"));
const StorytellerUserProjects = lazy(
  () => import("@/pages/storyteller/UserProjects.tsx"),
);
const CrawlerIndex = lazy(() =>
  import("@/pages/crawler").then((module) => ({
    default: module.CrawlerIndex,
  })),
);
const CaptureThread = lazy(() =>
  import("@/pages/threads/capture.tsx").then((module) => ({
    default: module.CaptureThread,
  })),
);
const YieldMaxEtfs = lazy(() =>
  import("@/pages/etfs/yieldmax.tsx").then((module) => ({
    default: module.YieldMaxEtfs,
  })),
);
const TwseEtf = lazy(() => import("@/pages/etfs/twse.tsx"));
const Userscripts = lazy(() => import("@/pages/tools/userscripts.tsx"));
const Webshot = lazy(() => import("@/pages/tools/webshot.tsx"));
const McpTools = lazy(() => import("@/pages/tools/mcp.tsx"));
const Nekomaid = lazy(() => import("@/pages/nekomaid"));
const GalgameHome = lazy(() => import("@/pages/galgame"));
const GalgameBrand = lazy(() => import("@/pages/galgame/brand.tsx"));
const GalgameVideo = lazy(() => import("@/pages/galgame/video.tsx"));
const GalgameFavorites = lazy(() => import("@/pages/galgame/favorites.tsx"));
const GalgameSubmitBrand = lazy(
  () => import("@/pages/galgame/submit-brand.tsx"),
);
const GalgameSubmitVideo = lazy(
  () => import("@/pages/galgame/submit-video.tsx"),
);
const GalgameAdmin = lazy(() => import("@/pages/galgame/admin.tsx"));

function LoadingFallback() {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 3,
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 48%, #f6f7fb 100%)",
      }}
    >
      <Stack
        spacing={2}
        alignItems="center"
        sx={{
          width: "min(100%, 360px)",
          textAlign: "center",
        }}
      >
        <Box
          component="img"
          src="/faryne-icon-1024.jpg"
          alt="Faryne mascot"
          sx={{
            width: 112,
            height: 112,
            borderRadius: 4,
            objectFit: "cover",
            boxShadow: "0 16px 40px rgba(25, 118, 210, 0.18)",
          }}
        />

        <CircularProgress size={28} thickness={4} color="primary" />

        <Box>
          <Typography
            component="p"
            variant="h6"
            sx={{ fontWeight: 800, color: "text.primary" }}
          >
            女僕正在整理頁面
          </Typography>
          <Typography
            component="p"
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            請稍等一下，馬上替主人把資料端上來。
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(`${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return null;
}

function App() {
  const standaloneGalgame = isGalgameSite();
  const standaloneNekomaid = isNekomaidSite();

  return (
    <BrowserRouter>
      <AnalyticsTracker />
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {standaloneNekomaid && (
            <Route path={""} element={<NekomaidLayout />}>
              <Route path={"/"} element={<Nekomaid />} />
              <Route path={"/:site"} element={<Nekomaid />} />
              <Route path={"/:site/:authorId"} element={<Nekomaid />} />
              <Route
                path={"/:site/:authorId/:artworkId"}
                element={<Nekomaid />}
              />
              <Route path={"*"} element={<ErrorPage code={404} />} />
            </Route>
          )}

          {standaloneGalgame && (
            <Route path={""} element={<GalgameLayout />}>
              <Route path={"/"} element={<GalgameHome />} />
              <Route path={"/favorites"} element={<GalgameFavorites />} />
              <Route path={"/submit"} element={<GalgameSubmitBrand />} />
              <Route path={"/submit-video"} element={<GalgameSubmitVideo />} />
              <Route path={"/admin"} element={<GalgameAdmin />} />
              <Route path={"/:brandSlug"} element={<GalgameBrand />} />
              <Route
                path={"/:brandSlug/video/:videoId"}
                element={<GalgameVideo />}
              />
              <Route path={"*"} element={<ErrorPage code={404} />} />
            </Route>
          )}

          {!standaloneGalgame && !standaloneNekomaid && (
            <>
              <Route path={"storyteller"} element={<StorytellerLayout />}>
                <Route path={""} element={<StorytellerPublicHome />} />
                <Route path={"my"}>
                  <Route path={""} element={<StorytellerHome />} />
                  <Route path={"project"} element={<StorytellerHome />} />
                  <Route path={"agent"} element={<StorytellerHome />} />
                  <Route
                    path={"project/new"}
                    element={<StorytellerNewProject />}
                  />
                  <Route
                    path={"project/:id/edit"}
                    element={<StorytellerNewProject />}
                  />
                  <Route
                    path={"project/:id/story/:storyId/diff/:diffId1/:diffId2"}
                    element={<StorytellerStoryDiffCompare />}
                  />
                  <Route
                    path={"project/:id/lore/:loreId/diff/:diffId1/:diffId2"}
                    element={<StorytellerLoreDiffCompare />}
                  />
                  <Route
                    path={"agent/:agentId/diff/:diffId1/:diffId2"}
                    element={<StorytellerAgentDiffCompare />}
                  />
                  <Route
                    path={"project/:id/story/:storyId/diff"}
                    element={<StorytellerStoryEditor />}
                  />
                  <Route
                    path={"project/:id/story/:storyId"}
                    element={<StorytellerStoryEditor />}
                  />
                  <Route
                    path={"project/:id/lore/:loreId"}
                    element={<StorytellerLoreEditor />}
                  />
                  <Route
                    path={"project/:id"}
                    element={<StorytellerProjectDetail />}
                  />
                  <Route path={"project/resources"} element={<Editor />} />
                  <Route path={"project/resource/:id"} element={<Editor />} />
                  <Route path={"project/articles"} element={<Editor />} />
                  <Route path={"project/article/:id"} element={<Editor />} />
                  <Route path={"agent/new"} element={<StorytellerNewAgent />} />
                  <Route
                    path={"agent/:agentId/edit"}
                    element={<StorytellerNewAgent />}
                  />
                  <Route
                    path={"api-keys"}
                    element={<StorytellerApiKeyManagement />}
                  />
                </Route>
                <Route
                  path={"user/:username"}
                  element={<StorytellerUserProjects />}
                />
                <Route path={"favorites"} element={<StorytellerFavorites />} />
                <Route path={"profile"} element={<StorytellerProfile />} />
                <Route
                  path={"story/share/:shareToken"}
                  element={<StorytellerReader />}
                />
                <Route
                  path={"story/share/:shareToken/:storyId"}
                  element={<StorytellerReader />}
                />
                <Route path={"story/*"} element={<StorytellerReader />} />
                <Route path={"editor"} element={<Editor />} />
                <Route path={"*"} element={<ErrorPage code={404} />} />
              </Route>

              <Route path={"galgame"} element={<GalgameLayout />}>
                <Route path={""} element={<GalgameHome />} />
                <Route path={"favorites"} element={<GalgameFavorites />} />
                <Route path={"submit"} element={<GalgameSubmitBrand />} />
                <Route path={"submit-video"} element={<GalgameSubmitVideo />} />
                <Route path={"admin"} element={<GalgameAdmin />} />
                <Route path={":brandSlug"} element={<GalgameBrand />} />
                <Route
                  path={":brandSlug/video/:videoId"}
                  element={<GalgameVideo />}
                />
              </Route>

              <Route path={"/nekomaid"} element={<NekomaidLayout />}>
                <Route path={""} element={<Nekomaid />} />
                <Route path={":site"} element={<Nekomaid />} />
                <Route path={":site/:authorId"} element={<Nekomaid />} />
                <Route
                  path={":site/:authorId/:artworkId"}
                  element={<Nekomaid />}
                />
                <Route path={"*"} element={<ErrorPage code={404} />} />
              </Route>

              <Route path={"/"} element={<LabLayout />}>
                <Route path={""} element={<LabHome />} />
              </Route>
              <Route path={""} element={<DefaultLayout />}>
                <Route path={"/av/video/:no"} element={<AVVideoDetail />} />
                <Route path={"/av/video"} element={<AVVideo />} />
                <Route
                  path={"/av/actress/:name"}
                  element={<AVActressDetail />}
                />
                <Route path={"/av/actress"} element={<AVActress />} />

                <Route
                  path={"/data/tw-stats/:name"}
                  element={<TwStatsByName />}
                />
                <Route path={"/data/tw-stats"} element={<TwStatsIndex />} />

                <Route path={"/data/rates"} element={<RatesIndex />} />
                <Route path={"/data/nccc"} element={<NCCC />} />
                <Route path={"/data/nccc/:token"} element={<NCCC />} />

                <Route
                  path={"/data/fire/realtime"}
                  element={<FireDepartmentRealtime />}
                />
                <Route
                  path={"/data/taipower/neighbor"}
                  element={<TaipowerNeighbor />}
                />
                <Route
                  path={"/data/taipower/neighbor/cityarea"}
                  element={<TaipowerNeighborStatistics />}
                />
                <Route
                  path={"/data/taipower/neighbor/unit"}
                  element={<TaipowerNeighborStatistics />}
                />
                <Route
                  path={"/data/taipower/neighbor/cityarea/:cityarea"}
                  element={<TaipowerNeighbor />}
                />
                <Route
                  path={"/data/taipower/neighbor/unit/:unit"}
                  element={<TaipowerNeighbor />}
                />
                <Route
                  path={"/data/taipower/neighbor/map"}
                  element={<TaipowerNeighborMap />}
                />

                <Route path={"/tools/crawler"} element={<CrawlerIndex />} />

                <Route
                  path={"/tools/thread/capture"}
                  element={<CaptureThread />}
                />
                <Route path={"/tools/webshot"} element={<Webshot />} />
                <Route path={"/tools/webshot/:hash"} element={<Webshot />} />
                <Route path={"/tools/userscripts"} element={<Userscripts />} />
                <Route path={"/tools/mcp"} element={<McpTools />} />

                <Route path={"/data/etf/yieldmax"} element={<YieldMaxEtfs />} />
                <Route
                  path={"/data/etf/yieldmax/:etfCode"}
                  element={<YieldMaxEtfs />}
                />
                <Route path={"/data/etf/twse"} element={<TwseEtf />} />
                <Route path={"/data/etf/twse/:code"} element={<TwseEtf />} />

                <Route path="/a" element={<h1>Hello</h1>} />

                <Route path={"/about"} element={<About />} />
                <Route path={"/cv"} element={<Cv />} />
                <Route path={"/login"} element={<Login />} />
                <Route
                  path={"/auth/encrypted-demo"}
                  element={<EncryptedDemo />}
                />
                <Route path={"*"} element={<ErrorPage code={404} />} />
              </Route>

              <Route path={"/modern"} element={<ModernLayout />}>
                <Route
                  path={""}
                  element={
                    <div>
                      <h1>Modern Layout Demo</h1>
                      <p>這是使用新版 Header 與 Footer 的 ModernLayout。</p>
                    </div>
                  }
                />
                <Route path={"*"} element={<ErrorPage code={404} />} />
              </Route>
            </>
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
