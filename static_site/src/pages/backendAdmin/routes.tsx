import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";

import { BACKEND_ADMIN_PATH } from "@/helpers/backendAdmin.ts";

// 整合後台的路由樹：App.tsx 只掛這一段，頁面一律 lazy load，不影響前台的 bundle
const BackendAdminLayout = lazy(() =>
  import("@/layouts/BackendAdminLayout.tsx").then((m) => ({
    default: m.BackendAdminLayout,
  })),
);
const Dashboard = lazy(() =>
  import("@/pages/backendAdmin/Dashboard.tsx").then((m) => ({
    default: m.BackendAdminDashboard,
  })),
);
const NotFound = lazy(() =>
  import("@/pages/backendAdmin/NotFound.tsx").then((m) => ({
    default: m.BackendAdminNotFound,
  })),
);
const GalgameBrands = lazy(() =>
  import("@/pages/backendAdmin/galgame/Brands.tsx").then((m) => ({
    default: m.GalgameAdminBrands,
  })),
);
const GalgameVideos = lazy(() =>
  import("@/pages/backendAdmin/galgame/Videos.tsx").then((m) => ({
    default: m.GalgameAdminVideos,
  })),
);
const GalgameBrandSubmissions = lazy(() =>
  import("@/pages/backendAdmin/galgame/BrandSubmissions.tsx").then((m) => ({
    default: m.GalgameAdminBrandSubmissions,
  })),
);
const GalgameVideoSubmissions = lazy(() =>
  import("@/pages/backendAdmin/galgame/VideoSubmissions.tsx").then((m) => ({
    default: m.GalgameAdminVideoSubmissions,
  })),
);
const GalgameTitleKeywords = lazy(() =>
  import("@/pages/backendAdmin/galgame/TitleKeywords.tsx").then((m) => ({
    default: m.GalgameAdminTitleKeywords,
  })),
);
const AVSubmissions = lazy(() =>
  import("@/pages/backendAdmin/av/actress_submissions.tsx").then((m) => ({
    default: m.AVActressSubmissions,
  })),
);
const AVSubmissionReview = lazy(() =>
  import("@/pages/backendAdmin/av/actress_submission_review.tsx").then((m) => ({
    default: m.AVActressSubmissionReview,
  })),
);
const AVTopicManage = lazy(() =>
  import("@/pages/backendAdmin/av/actress_topic_manage.tsx").then((m) => ({
    default: m.AVActressTopicManage,
  })),
);
const AVTopicEdit = lazy(() =>
  import("@/pages/backendAdmin/av/actress_topic_edit.tsx").then((m) => ({
    default: m.AVActressTopicEdit,
  })),
);

/** /backend_admin 底下的路由；權限閘門在 BackendAdminLayout */
export const backendAdminRoutes = (
  <Route path={BACKEND_ADMIN_PATH} element={<BackendAdminLayout />}>
    <Route index element={<Dashboard />} />
    <Route path={"galgame"}>
      <Route index element={<Navigate replace to={"brands"} />} />
      <Route path={"brands"} element={<GalgameBrands />} />
      <Route path={"videos"} element={<GalgameVideos />} />
      <Route path={"brand-submissions"} element={<GalgameBrandSubmissions />} />
      <Route path={"video-submissions"} element={<GalgameVideoSubmissions />} />
      <Route path={"title-keywords"} element={<GalgameTitleKeywords />} />
    </Route>
    <Route path={"av"}>
      <Route index element={<Navigate replace to={"submissions"} />} />
      <Route path={"submissions"} element={<AVSubmissions />} />
      <Route path={"submissions/:id"} element={<AVSubmissionReview />} />
      <Route path={"topics"} element={<AVTopicManage />} />
      {/* :id 為 new 時是新增 */}
      <Route path={"topics/:id"} element={<AVTopicEdit />} />
    </Route>
    <Route path={"*"} element={<NotFound />} />
  </Route>
);
