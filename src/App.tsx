import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";

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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/markets" element={<Markets />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/stock/:symbol" element={<Stock />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/philosophy" element={<AdminPhilosophy />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/risk" element={<PracticeRisk />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
