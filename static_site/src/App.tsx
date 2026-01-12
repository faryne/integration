import './components/common/Header.tsx';
import { BrowserRouter, Routes, Route } from "react-router-dom"
import {DefaultLayout} from "./layouts/DefaultLayout.tsx";

function App() {
  // const [count, setCount] = useState(0)

  return (
    <BrowserRouter>
      <Routes>
          <Route path={""} element={<DefaultLayout />}>
              <Route path="/a" element={<><h1>Hello</h1></>} />
          </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
