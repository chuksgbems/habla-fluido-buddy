import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import { AuthGuard } from "@/components/AuthGuard";
import { Layout } from "@/components/layout/Layout";
import Home from "./pages/Home";
import LearnPath from "./pages/LearnPath";
import LessonPlayer from "./pages/LessonPlayer";
import ChatTutor from "./pages/ChatTutor";
import Practice from "./pages/Practice";
import Pronunciation from "./pages/Pronunciation";
import ProgressPage from "./pages/Progress";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/learn" element={<AuthGuard><LearnPath /></AuthGuard>} />
                <Route path="/lesson/:lessonId" element={<AuthGuard><LessonPlayer /></AuthGuard>} />
                <Route path="/chat" element={<AuthGuard><ChatTutor /></AuthGuard>} />
                <Route path="/practice" element={<AuthGuard><Practice /></AuthGuard>} />
                <Route path="/pronunciation" element={<AuthGuard><Pronunciation /></AuthGuard>} />
                <Route path="/progress" element={<AuthGuard><ProgressPage /></AuthGuard>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/settings" element={<AuthGuard><Settings /></AuthGuard>} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
