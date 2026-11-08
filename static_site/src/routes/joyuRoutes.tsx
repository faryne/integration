import { lazy, type ComponentType } from "react";
import { Route } from "react-router-dom";

import { ParamRedirect } from "@/components/common/ParamRedirect.tsx";
import { JoyuLayout } from "@/layouts/JoyuLayout.tsx";
import { ErrorPage } from "@/pages/ErrorPage.tsx";

// joyu.fyi（AV 女優資料站）的路由樹，從 App.tsx 抽出來避免它繼續長大。
// 網址規則：faryne.dev/av/* 拿掉 /av 前綴；女優搜尋列表直接當首頁（nginx 負責舊網址 301，見 httpd_conf/nginx）。
const lazyNamed = <K extends string>(
  load: () => Promise<Record<K, ComponentType>>,
  name: K,
) => lazy(() => load().then((m) => ({ default: m[name] })));

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
    <Route path={"/"} element={<AVActress />} />
    {/* 剛好打到 /actress（女優列表的舊位置）轉回首頁，?name= 等查詢字串原樣帶過去 */}
    <Route path={"/actress"} element={<ParamRedirect to={() => "/"} />} />
    {/* 上稿、主題要排在 :name 前面（靜態路徑本來就優先，排前面讀起來比較清楚） */}
    <Route path={"/actress/submit"} element={<AVActressSubmit />} />
    <Route path={"/actress/topics"} element={<AVActressTopics />} />
    <Route path={"/actress/topics/:slug"} element={<AVActressTopic />} />
    <Route path={"/actress/:name/edit"} element={<AVActressEdit />} />
    <Route path={"/actress/:name"} element={<AVActressDetail />} />
    <Route path={"/video"} element={<AVVideo />} />
    <Route path={"/video/:no/edit"} element={<AVVideoEdit />} />
    <Route path={"/video/:no"} element={<AVVideoDetail />} />
    <Route path={"*"} element={<ErrorPage code={404} />} />
  </Route>
);
