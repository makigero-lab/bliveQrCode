import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
// Add page imports here
import Menu from "./pages/Menu";
import Admin from "./pages/Admin";
import Staff from "./pages/Staff";
import Login from "./pages/Login";
import { BarSettingsProvider } from "@/lib/BarSettingsContext";
import RequireAuth from "@/components/RequireAuth";
import { Loader2 } from "lucide-react";

const AuthenticatedApp = () => {
  const { isLoadingAuth, authChecked, isAuthenticated, user } = useAuth();

  // Enquanto o onAuthStateChanged não dispara, mostra spinner.
  // Aplica-se a todas as rotas (incluindo /login — para não
  // flashing do formulário antes de sabermos se há sessão).
  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      {/* Pública: menu do cliente (acessível sem login) */}
      <Route path="/" element={<Menu />} />
      <Route path="/menu" element={<Menu />} />

      {/* Login: se já autenticado, redireciona para a rota certa */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === "admin" ? "/admin" : "/staff"} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Protegidas: /admin só admin; /staff admin ou staff */}
      <Route
        path="/admin"
        element={
          <RequireAuth requireRole="admin">
            <Admin />
          </RequireAuth>
        }
      />
      <Route
        path="/staff"
        element={
          <RequireAuth requireRole="staff">
            <Staff />
          </RequireAuth>
        }
      />

      {/* 404 */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <BarSettingsProvider>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </BarSettingsProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
