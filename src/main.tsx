import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { applyLiquidGlassAttribute, getInitialLiquidGlassEnabled } from "./lib/liquidGlassPreference";
import "./index.css";

applyLiquidGlassAttribute(getInitialLiquidGlassEnabled());

window.addEventListener("vite:preloadError", () => {
  // Auto-recover from stale preloaded chunk references after a deploy.
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
