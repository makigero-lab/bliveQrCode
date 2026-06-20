// src/pages/Login.jsx
// -------------------------------------------------------------
// Página de Login (Firebase Auth — Email/Password)
// -------------------------------------------------------------
// Formulário simples com email + password. Chama `login()` do
// AuthContext. Em caso de sucesso, redireciona para:
//   - /admin se o utilizador for admin
//   - /staff se for staff
//
// Em caso de erro, mostra mensagem do Firebase traduzida para PT.
// -------------------------------------------------------------

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Wine, Mail, Lock, LogIn, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

// Tradução dos códigos de erro do Firebase Auth para PT-PT
function translateFirebaseError(code) {
  const map = {
    "auth/invalid-credential":
      "Email ou palavra-passe incorretos.",
    "auth/wrong-password": "Email ou palavra-passe incorretos.",
    "auth/user-not-found": "Email ou palavra-passe incorretos.",
    "auth/invalid-email": "Email inválido.",
    "auth/too-many-requests":
      "Demasiadas tentativas. Tenta novamente mais tarde.",
    "auth/network-request-failed":
      "Sem ligação à internet. Verifica a rede e tenta novamente.",
    "auth/configuration-not-found":
      "Método de login não configurado. Contacta o administrador.",
  };
  return map[code] || "Erro ao fazer login. Tenta novamente.";
}

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Preenche email e palavra-passe.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // `login()` agora retorna o user COM role (espera pelo
      // onAuthStateChanged + getUserProfile). Já pode redirecionar
      // para a rota certa sem depender de state externo.
      const user = await login(email, password);

      // Redireciona conforme a role:
      // - admin → /admin
      // - staff → /staff
      // (qualquer outra role → /staff por defeito)
      const target = user.role === "admin" ? "/admin" : "/staff";
      navigate(target, { replace: true });
    } catch (err) {

      // Erros personalizados do AuthContext (não Firebase Auth)
      if (err?.type === "user_not_registered") {
        setError(
          "A tua conta não tem perfil associado. Contacta o administrador do bar."
        );
      } else if (err?.type === "user_inactive") {
        setError(
          "A tua conta está desativada. Contacta o administrador do bar."
        );
      } else {
        // Erros do Firebase Auth (auth/invalid-credential, etc.)
        setError(
          translateFirebaseError(err?.code) ||
            err?.message ||
            "Erro desconhecido."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-5">
      {/* Glow de fundo */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(233, 30, 140, 0.15), transparent 50%), radial-gradient(circle at 50% 70%, rgba(255, 26, 26, 0.08), transparent 50%)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-sm bg-card border border-border/50 rounded-3xl p-7 shadow-2xl"
      >
        {/* Logo / Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mb-3">
            <Wine className="w-7 h-7 text-primary" />
          </div>
          <h1 className="font-playfair font-bold text-2xl text-foreground">
            B'Live Staff
          </h1>
          <p className="text-muted-foreground text-xs mt-1">
            Inicia sessão para aceder ao painel
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@blive.pt"
              autoComplete="email"
              disabled={loading}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Lock className="w-3 h-3" /> Palavra-passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-[10px] text-muted-foreground/60 text-center mt-5">
          Acesso restrito a staff e administradores autorizados.
          <br />
          Contacta o gestor do bar se precisas de uma conta.
        </p>
      </motion.div>
    </div>
  );
}
