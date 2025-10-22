import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
// import Dashboard from "./pages/Dashboard"; // Temporarily hidden
import Events from "./pages/Events";
import RollingEventsResults from "./pages/RollingEventsResults";
import RoundsDashboard from "./pages/RoundsDashboard";
import RoundEvaluation from "./pages/RoundEvaluation";
import Teams from "./pages/Teams";
import Leaderboard from "./pages/Leaderboard";
import Finance from "./pages/Finance";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable refetch on window focus
      refetchOnReconnect: false,   // Disable refetch on network reconnect
      staleTime: 30 * 1000,       // Consider data fresh for 30 seconds (shorter for better responsiveness)
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            {/* Temporarily hidden - Dashboard route
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            */}
            <Route 
              path="/events" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <Events />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rolling-results" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <RollingEventsResults />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/rounds" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <RoundsDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/round-evaluation" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <RoundEvaluation />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/teams" 
              element={
                <ProtectedRoute requiredRoles={['admin', 'clubs']}>
                  <Teams />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/leaderboard" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Leaderboard />
                </ProtectedRoute>
              } 
            />
            {/* Temporarily hidden - Finance route
            <Route 
              path="/finance" 
              element={
                <ProtectedRoute requiredRole="admin">
                  <Finance />
                </ProtectedRoute>
              } 
            />
            */}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
