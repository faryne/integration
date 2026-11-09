import { lazy, type ComponentType } from "react";
import { Route } from "react-router-dom";

import { JoyuLayout } from "@/layouts/JoyuLayout.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

// joyu.fyi（AV 女優資料站）的路由樹，從 App.tsx 抽出來避免它繼續長大。
// 網址規則：faryne.dev/av/* 拿掉 /av 前綴（nginx 負責舊網址 301，見 httpd_conf/nginx）；首頁是入口頁，女優搜尋列表在 /actress。
const lazyNamed = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => load().then((m) => ({ default: m[name] })));

const JoyuHome = lazyNamed(() => import("@/pages/joyu/Home.tsx"), "JoyuHome");
const JoyuMyFollows = lazyNamed(
  () => import("@/pages/joyu/MyFollows.tsx"),
  "JoyuMyFollows",
);
const JoyuMyProfile = lazyNamed(
  () => import("@/pages/joyu/MyProfile.tsx"),
  "JoyuMyProfile",
);
const JoyuMyVideos = lazyNamed(
  () => import("@/pages/joyu/MyVideos.tsx"),
  "JoyuMyVideos",
);
const AVActress = lazyNamed(
  () => import("@/pages/av/actress.tsx"),
  "AVActress",
);
const AVActressDetail = lazyNamed(
  () => import("@/pages/av/actress_detail.tsx"),
  "AVActressDetail",
);
const AVActressSubmit = lazyNamed(
  () => import("@/pages/av/actress_submit.tsx"),
  "AVActressSubmit",
);
const AVActressEdit = lazyNamed(
  () => import("@/pages/av/actress_submit.tsx"),
  "AVActressEdit",
);
const AVActressTopics = lazyNamed(
  () => import("@/pages/av/actress_topics.tsx"),
  "AVActressTopics",
);
const AVActressTopic = lazyNamed(
  () => import("@/pages/av/actress_topic.tsx"),
  "AVActressTopic",
);
const AVVideo = lazyNamed(() => import("@/pages/av/video.tsx"), "AVVideo");
const AVVideoDetail = lazyNamed(
  () => import("@/pages/av/video_detail.tsx"),
  "AVVideoDetail",
);
const AVVideoEdit = lazyNamed(
  () => import("@/pages/av/video_edit.tsx"),
  "AVVideoEdit",
);

export const joyuRoutes = (
  <Route path={""} element={<JoyuLayout />}>
    <Route path={"/"} element={<JoyuHome />} />
    <Route path={"/actress"} element={<AVActress />} />
    {/* 上稿、主題要排在 :name 前面（靜態路徑本來就優先，排前面讀起來比較清楚） */}
    <Route path={"/actress/submit"} element={<AVActressSubmit />} />
    <Route path={"/actress/topics"} element={<AVActressTopics />} />
    <Route path={"/actress/topics/:slug"} element={<AVActressTopic />} />
    <Route path={"/actress/:name/edit"} element={<AVActressEdit />} />
    <Route path={"/actress/:name"} element={<AVActressDetail />} />
    <Route path={"/video"} element={<AVVideo />} />
    <Route path={"/video/:no/edit"} element={<AVVideoEdit />} />
    <Route path={"/video/:no"} element={<AVVideoDetail />} />
    <Route path={"/me/follows"} element={<JoyuMyFollows />} />
    <Route path={"/me/videos"} element={<JoyuMyVideos />} />
    <Route path={"/me/profile"} element={<JoyuMyProfile />} />
    <Route path={"*"} element={<ErrorPage code={404} />} />
  </Route>
);
