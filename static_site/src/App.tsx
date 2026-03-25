import "./components/common/Header.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { AVVideo } from "@/pages/av/video.tsx";
import { AVActress } from "@/pages/av/actress.tsx";
import { AVActressDetail } from "@/pages/av/actress_detail.tsx";
import { AVVideoDetail } from "@/pages/av/video_detail.tsx";
import { TwStatsIndex } from "@/pages/opendata/twstats_index.tsx";
import { TwStatsByName } from "@/pages/opendata/twstats_byname.tsx";
import { FireDepartmentRealtime } from "@/pages/opendata/firedepartment_realtime.tsx";
import { RatesIndex } from "@/pages/opendata/rates_index.tsx";
import {Editor} from "@/pages/storyteller/editor.tsx";
import {CrawlerIndex} from "@/pages/crawler";
import {CaptureThread} from "@/pages/threads/capture.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={"storyteller"} element={<DefaultLayout fullWidth={true} />}>
          <Route path={""} element={<Editor />} />

          <Route path={"project"}>
            <Route path={":id"} element={<Editor />} />
            <Route path={"resources"} element={<Editor />} />
            <Route path={"resource/:id"} element={<Editor />} />
            <Route path={"articles"} element={<Editor />} />
            <Route path={"article/:id"} element={<Editor />} />

          </Route>
          <Route path={"editor"} element={<Editor />}/>
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

          <Route
            path={"/tools/crawler"}
            element={<CrawlerIndex />}
          />

          <Route
            path={"/tools/thread/capture"}
            element={<CaptureThread />}
            />



          <Route path="/a" element={<h1>Hello</h1>} />
        </Route>

        <Route path="*" element={<h1>404</h1>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
