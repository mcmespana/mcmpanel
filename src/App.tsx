import { lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import { LoginPage } from "./components/LoginPage";
import { isAuthenticated } from "./lib/auth";

// /informe/<slug> es PÚBLICA: la abre cualquiera con el enlace, sin código de
// acceso. Va en su propio chunk para no cargar el panel entero en el móvil.
const PublicReport = lazy(() => import("./pages/PublicReport"));
const PUBLIC_REPORT = /^\/informe\/([a-z0-9-]{3,64})\/?$/;

const queryClient = new QueryClient();

const App = () => {
  const [authed, setAuthed] = useState(isAuthenticated());

  const publicMatch = window.location.pathname.match(PUBLIC_REPORT);
  if (publicMatch) {
    return (
      <Suspense fallback={null}>
        <PublicReport slug={publicMatch[1]} />
      </Suspense>
    );
  }

  if (!authed) {
    return <LoginPage onLogin={() => setAuthed(true)} />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* The whole admin lives behind a single mount so the Firebase
                subscription survives navigation. JSONManager reads the URL to
                decide which section (or the home dashboard) to render. */}
            <Route path="*" element={<Index />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
