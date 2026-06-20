import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";

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
const NotFound = lazy(() => import("./pages/NotFound"));

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
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <ErrorBoundary>
        <PageTransition>
        <Routes>
          <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
          <Route path="/markets" element={<ErrorBoundary><Markets /></ErrorBoundary>} />
          <Route path="/portfolio" element={<ErrorBoundary><Portfolio /></ErrorBoundary>} />
          <Route path="/chat" element={<ErrorBoundary><Chat /></ErrorBoundary>} />
          <Route path="/terms" element={<ErrorBoundary><Terms /></ErrorBoundary>} />
          <Route path="/privacy" element={<ErrorBoundary><Privacy /></ErrorBoundary>} />
          <Route path="/stock/:symbol" element={<ErrorBoundary><Stock /></ErrorBoundary>} />
          <Route path="/auth" element={<ErrorBoundary><Auth /></ErrorBoundary>} />
          <Route path="/admin/philosophy" element={<ErrorBoundary><AdminPhilosophy /></ErrorBoundary>} />
          <Route path="/alerts" element={<ErrorBoundary><Alerts /></ErrorBoundary>} />
          <Route path="/practice" element={<ErrorBoundary><Practice /></ErrorBoundary>} />
          <Route path="/practice/risk" element={<ErrorBoundary><PracticeRisk /></ErrorBoundary>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </PageTransition>
        </ErrorBoundary>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
