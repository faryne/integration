import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { ModernLayout } from "./layouts/ModernLayout.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

const Home = lazy(() => import("@/pages/Home.tsx"));
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

function LoadingFallback() {
  return <div className="route-loading">載入中</div>;
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
            <Route path={"/tools/userscripts"} element={<Userscripts />} />

            <Route path={"/data/etf/yieldmax"} element={<YieldMaxEtfs />} />
            <Route path={"/data/etf/twse"} element={<TwseEtf />} />

            <Route path="/a" element={<h1>Hello</h1>} />

            <Route path={"/"} element={<Home />} />
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
