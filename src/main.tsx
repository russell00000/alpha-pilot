import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Recover from transient module-loading failures — but never loop.
// One reload attempt per 60s window, tracked in localStorage so a reload
// (which resets sessionStorage listeners) can't retrigger endlessly.
const RELOAD_KEY = "__chunk_reload_at__";
const isRecoverableModuleError = (msg?: string) =>
  !!msg &&
  /(Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|error loading dynamically imported module|Failed to load module script|module script failed)/i.test(msg);
const tryReload = () => {
  try {
    const last = Number(localStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return; // already tried recently — don't flash
    localStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
};
window.addEventListener("error", (e) => {
  // Only act on genuine module-script failures, never on failed images/fetches.
  if (isRecoverableModuleError(e?.message)) tryReload();
});
window.addEventListener("unhandledrejection", (e) => {
  const reason = (e as PromiseRejectionEvent).reason;
  if (isRecoverableModuleError(reason?.message || String(reason))) tryReload();
});


createRoot(document.getElementById("root")!).render(<App />);
