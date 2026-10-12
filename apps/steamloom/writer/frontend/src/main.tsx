import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@writer/App.tsx";
import "@writer/i18n/index.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
