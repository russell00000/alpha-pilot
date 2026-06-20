import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recover from transient dev-server or module loading failures instead of leaving a blank screen.
const RELOAD_KEY = "__chunk_reload__";
const isRecoverableModuleError = (msg?: string) =>
  !!msg &&
  /(Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|error loading dynamically imported module|Failed to load module script|module script failed|The service is no longer running|Outdated Optimize Dep|Pre-transform error|Internal server error)/i.test(msg);
const tryReload = () => {
  if (sessionStorage.getItem(RELOAD_KEY)) return;
  sessionStorage.setItem(RELOAD_KEY, "1");
  window.location.reload();
};
window.addEventListener("error", (e) => {
  const target = e.target as HTMLElement | null;
  const src = target && ("src" in target ? String((target as HTMLScriptElement).src) : "");
  if (isRecoverableModuleError(e?.message) || src.includes("/src/") || src.includes("/@vite/")) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = (e as PromiseRejectionEvent).reason;
  if (isRecoverableModuleError(reason?.message || String(reason))) tryReload();
});
if (document.readyState === "complete") sessionStorage.removeItem(RELOAD_KEY);
else window.addEventListener("load", () => sessionStorage.removeItem(RELOAD_KEY));

createRoot(document.getElementById("root")!).render(<App />);
