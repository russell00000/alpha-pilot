import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Lumea from "./pages/Lumea";
import Markets from "./pages/Markets";
import Portfolio from "./pages/Portfolio";
import Chat from "./pages/Chat";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Stock from "./pages/Stock";
import Auth from "./pages/Auth";
import AdminPhilosophy from "./pages/AdminPhilosophy";
import Alerts from "./pages/Alerts";
import Practice from "./pages/Practice";
import PracticeRisk from "./pages/PracticeRisk";
import Screener from "./pages/Screener";
import PortfolioAnalysis from "./pages/PortfolioAnalysis";
import NotFound from "./pages/NotFound";
import PageTransition from "./components/PageTransition";
import ErrorBoundary from "./components/ErrorBoundary";
import AmbientBackground from "./components/AmbientBackground";

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
        <PageTransition>
        <Routes>
          <Route path="/" element={<ErrorBoundary><Lumea /></ErrorBoundary>} />
          <Route path="/home" element={<ErrorBoundary><Index /></ErrorBoundary>} />
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
        </PageTransition>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
