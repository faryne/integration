import "./components/common/Header.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { AVVideo } from "@/pages/av/video.tsx";
import { AVActress } from "@/pages/av/actress.tsx";
import { AVActressDetail } from "@/pages/av/actress_detail.tsx";
import { AVVideoDetail } from "@/pages/av/video_detail.tsx";
import { TwStatsIndex } from "@/pages/opendata/twstats_index.tsx";
import { TwStatsByName } from "@/pages/opendata/twstats_byname.tsx";
import {FireDepartmentRealtime} from "@/pages/opendata/firedepartment_realtime.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={""} element={<DefaultLayout />}>
          <Route path={"/av/video/:no"} element={<AVVideoDetail />} />
          <Route path={"/av/video"} element={<AVVideo />} />
          <Route path={"/av/actress/:name"} element={<AVActressDetail />} />
          <Route path={"/av/actress"} element={<AVActress />} />

          <Route path={"/data/tw-stats/:name"} element={<TwStatsByName />} />
          <Route path={"/data/tw-stats"} element={<TwStatsIndex />} />

          <Route path={"/data/fire/realtime"} element={<FireDepartmentRealtime />} />

          <Route path="/a" element={<h1>Hello</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
