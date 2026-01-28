import "./components/common/Header.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DefaultLayout } from "./layouts/DefaultLayout.tsx";
import { AVVideo } from "@/pages/av/video.tsx";
import { AVActress } from "@/pages/av/actress.tsx";
import {AVActressDetail} from "@/pages/av/actress_detail.tsx";
import {AVVideoDetail} from "@/pages/av/video_detail.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={""} element={<DefaultLayout />}>
          <Route>
            <Route path={"/av/video/:no"} element={<AVVideoDetail />} />
            <Route path={"/av/video"} element={<AVVideo />} />
            <Route path={"/av/actress/:name"} element={<AVActressDetail />} />
            <Route path={"/av/actress"} element={<AVActress />} />
          </Route>
          <Route path="/a" element={<h1>Hello</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
