// src/components/RequireAuth.jsx
// -------------------------------------------------------------
// RequireAuth (Firebase Auth real + role-based access)
// -------------------------------------------------------------
// Protege rotas (/admin, /staff) verificando:
//   1. Se há utilizador autenticado (Firebase Auth via onAuthStateChanged).
//      Se não → redireciona para /login.
//   2. Se o utilizador tem role compatível com a rota:
//      - /admin: só `role === "admin"`.
//      - /staff: `role === "admin"` OU `role === "staff"`.
//      Se staff tentar entrar em /admin → redireciona para /staff.
//
// Props:
//   - requireRole: "admin" | "staff" (default: "staff")
//   - children:    elemento a renderizar se autorizado
// -------------------------------------------------------------

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Wine, Loader2, ShieldAlert } from "lucide-react";

export default function RequireAuth({
  children,
  requireRole = "staff",
}) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, logout } =
    useAuth();
  const navigate = useNavigate();

  // Se ainda estamos à espera do primeiro disparo do
  // onAuthStateChanged, mostra spinner.
  if (isLoadingAuth || !authChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
          <p className="text-xs text-muted-foreground">
            A verificar sessão...
          </p>
        </div>
      </div>
    );
  }

  // Não autenticado → /login
  if (!isAuthenticated || !user) {
    // Redirect no próximo tick para evitar warning de navigate durante render
    setTimeout(() => navigate("/login", { replace: true }), 0);
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  // Verificação de role
  // /admin exige role "admin". Se staff tentar entrar → /staff.
  if (requireRole === "admin" && user.role !== "admin") {
    setTimeout(() => navigate("/staff", { replace: true }), 0);
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-sm space-y-3">
          <ShieldAlert className="w-10 h-10 text-yellow-400 mx-auto" />
          <h2 className="font-playfair font-bold text-lg">
            Acesso restrito
          </h2>
          <p className="text-sm text-muted-foreground">
            Apenas administradores podem aceder a esta página.
          </p>
          <p className="text-xs text-muted-foreground">
            A redirecionar para o ecrã de Staff...
          </p>
        </div>
      </div>
    );
  }

  // Tudo OK → renderiza children
  return children;
}
