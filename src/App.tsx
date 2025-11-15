import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { CRMProvider, useCRM } from "@/contexts/CRMContext";
import { useState, useEffect } from "react";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Pipeline from "./pages/Pipeline";
import LeadDetail from "./pages/LeadDetail";
import WhatsApp from "./pages/WhatsApp";
import NotFound from "./pages/NotFound";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import Membros from "./pages/Membros";
import BaseDeConhecimento from "./pages/BaseDeConhecimento";


import ClientPage from "./pages/ClientPage";
import { ThemeProvider } from "@/contexts/ThemeContext";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Desabilita refetch automático ao voltar para a aba
      refetchOnMount: true, // Mantém refetch ao montar componente
      refetchOnReconnect: true, // Mantém refetch ao reconectar
      staleTime: 5 * 60 * 1000, // 5 minutos - dados ficam "frescos" por este tempo
    },
  },
});

// Rota protegida básica - requer apenas autenticação
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loadingUser } = useCRM();
  
  // Mostrar loading enquanto verifica autenticação
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-primary light-title">Worklivoo</h1>
          <p className="text-xl text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth" replace />;
};



const AppRoutes = () => {
  const { isAuthenticated, loadingUser } = useCRM();

  // Mostrar loading enquanto verifica autenticação
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 text-primary light-title">Worklivoo</h1>
          <p className="text-xl text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth" element={isAuthenticated ? <Navigate to="/inicio" replace /> : <Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/inicio" : "/auth"} replace />} />
      <Route path="/inicio" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/leads" element={<ProtectedRoute><Layout><Pipeline /></Layout></ProtectedRoute>} />
      <Route path="/lead/:id" element={<ProtectedRoute><Layout><LeadDetail /></Layout></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><Layout><WhatsApp /></Layout></ProtectedRoute>} />
      <Route path="/membros" element={<ProtectedRoute><Layout><Membros /></Layout></ProtectedRoute>} />
      <Route path="/base-de-conhecimento" element={<ProtectedRoute><Layout><BaseDeConhecimento /></Layout></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />

      <Route path="/404" element={<NotFound />} />
      <Route path="/:clientUrl" element={<ClientPage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <CRMProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </CRMProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
