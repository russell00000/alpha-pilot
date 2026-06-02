import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recover from stale lazy-loaded chunks after a redeploy.
const RELOAD_KEY = "__chunk_reload__";
const isChunkError = (msg?: string) =>
  !!msg &&
  /(Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|error loading dynamically imported module)/i.test(
    msg
  );
const tryReload = () => {
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
};
window.addEventListener("error", (e) => {
  if (isChunkError(e?.message)) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  if (isChunkError((e as PromiseRejectionEvent).reason?.message)) tryReload();
});
if (document.readyState === "complete") sessionStorage.removeItem(RELOAD_KEY);
else window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_KEY));

createRoot(document.getElementById("root")!).render(<App />);
