import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
/* Landing experience stays in the initial bundle. */
import Root from "./pages/Root";
import Index from "./pages/Index";
/* Everything else is fetched on first visit to its route. */
const Markets = lazy(() => import("./pages/Markets"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const Chat = lazy(() => import("./pages/Chat"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Stock = lazy(() => import("./pages/Stock"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminPhilosophy = lazy(() => import("./pages/AdminPhilosophy"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Practice = lazy(() => import("./pages/Practice"));
const PracticeRisk = lazy(() => import("./pages/PracticeRisk"));
const Screener = lazy(() => import("./pages/Screener"));
const PortfolioAnalysis = lazy(() => import("./pages/PortfolioAnalysis"));
const NotFound = lazy(() => import("./pages/NotFound"));
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import AmbientBackground from "./components/AmbientBackground";
import MotionLayer from "./components/motion/MotionLayer";

/* Warm every page in the background once the landing page is idle, so
   switching tabs is instant instead of waiting on a download. */
if (typeof window !== "undefined") {
  const warm = () => {
    [
      () => import("./pages/Markets"),
      () => import("./pages/Stock"),
      () => import("./pages/Screener"),
      () => import("./pages/Portfolio"),
      () => import("./pages/Chat"),
      () => import("./pages/Practice"),
      () => import("./pages/Alerts"),
      () => import("./pages/PortfolioAnalysis"),
      () => import("./pages/PracticeRisk"),
      () => import("./pages/Auth"),
    ].forEach((load, i) => window.setTimeout(() => load().catch(() => {}), i * 250));
  };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  window.addEventListener("load", () => (ric ? ric(warm, { timeout: 3000 }) : window.setTimeout(warm, 1500)), { once: true });
}

/** Minimal, spinner-free fallback so route swaps never flash white. */
const RouteFallback = () => (
  <div style={{ minHeight: "100svh", background: "#080708" }} aria-hidden />
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cached data stays "fresh" for 5 min — no refetch on navigation/remount.
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ErrorBoundary>
        <AmbientBackground />
        <MotionLayer />
        <PageTransition>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<ErrorBoundary><Root /></ErrorBoundary>} />
          <Route path="/index" element={<ErrorBoundary><Index /></ErrorBoundary>} />
          <Route path="/markets" element={<ErrorBoundary><Markets /></ErrorBoundary>} />
          <Route path="/screener" element={<ErrorBoundary><Screener /></ErrorBoundary>} />
          <Route path="/portfolio" element={<ErrorBoundary><Portfolio /></ErrorBoundary>} />
          <Route path="/chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
          <Route path="/chat/:threadId" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
          <Route path="/stock/:symbol" element={<ErrorBoundary><Stock /></ErrorBoundary>} />
          <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
          <Route path="/admin/philosophy" element={<ErrorBoundary><AdminPhilosophy /></ErrorBoundary>} />
          <Route path="/alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
          <Route path="/practice" element={<ErrorBoundary><Practice /></ErrorBoundary>} />
          <Route path="/practice/risk" element={<ErrorBoundary><PracticeRisk /></ErrorBoundary>} />
          <Route path="/analysis" element={<ErrorBoundary><PortfolioAnalysis /></ErrorBoundary>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </PageTransition>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
