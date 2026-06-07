import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { ModernLayout } from "./layouts/ModernLayout.tsx";
import { NekomaidLayout } from "./layouts/NekomaidLayout.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

const Home = lazy(() => import("@/pages/Home.tsx"));
const About = lazy(() => import("@/pages/About/index.tsx"));
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
const RatesIndex = lazy(() =>
  import("@/pages/opendata/rates_index.tsx").then((module) => ({
    default: module.RatesIndex,
  })),
);
const Editor = lazy(() =>
  import("@/pages/storyteller/editor.tsx").then((module) => ({
    default: module.Editor,
  })),
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
const Nekomaid = lazy(() => import("@/pages/nekomaid"));

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

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route
            path={"storyteller"}
            element={<DefaultLayout fullWidth={true} />}
          >
            <Route path={""} element={<Editor />} />

            <Route path={"project"}>
              <Route path={":id"} element={<Editor />} />
              <Route path={"resources"} element={<Editor />} />
              <Route path={"resource/:id"} element={<Editor />} />
              <Route path={"articles"} element={<Editor />} />
              <Route path={"article/:id"} element={<Editor />} />
            </Route>
            <Route path={"editor"} element={<Editor />} />
            <Route path={"*"} element={<ErrorPage code={404} />} />
          </Route>

          <Route path={""} element={<DefaultLayout />}>
            <Route path={"/av/video/:no"} element={<AVVideoDetail />} />
            <Route path={"/av/video"} element={<AVVideo />} />
            <Route path={"/av/actress/:name"} element={<AVActressDetail />} />
            <Route path={"/av/actress"} element={<AVActress />} />

            <Route path={"/data/tw-stats/:name"} element={<TwStatsByName />} />
            <Route path={"/data/tw-stats"} element={<TwStatsIndex />} />

            <Route path={"/data/rates"} element={<RatesIndex />} />

            <Route
              path={"/data/fire/realtime"}
              element={<FireDepartmentRealtime />}
            />

            <Route path={"/tools/crawler"} element={<CrawlerIndex />} />

            <Route path={"/tools/thread/capture"} element={<CaptureThread />} />
            <Route path={"/tools/webshot"} element={<Webshot />} />
            <Route path={"/tools/webshot/:hash"} element={<Webshot />} />
            <Route path={"/tools/userscripts"} element={<Userscripts />} />

            <Route path={"/data/etf/yieldmax"} element={<YieldMaxEtfs />} />
            <Route path={"/data/etf/twse"} element={<TwseEtf />} />
            <Route path={"/data/etf/twse/:code"} element={<TwseEtf />} />

            <Route path="/a" element={<h1>Hello</h1>} />

            <Route path={"/about"} element={<About />} />
            <Route path={"/"} element={<Home />} />
            <Route path={"*"} element={<ErrorPage code={404} />} />
          </Route>

          <Route path={"/nekomaid"} element={<NekomaidLayout />}>
            <Route path={""} element={<Nekomaid />} />
            <Route path={":site"} element={<Nekomaid />} />
            <Route path={":site/:authorId"} element={<Nekomaid />} />
            <Route path={":site/:authorId/:artworkId"} element={<Nekomaid />} />
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
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
