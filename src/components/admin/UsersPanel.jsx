// src/components/admin/UsersPanel.jsx
// -------------------------------------------------------------
// Gestão de Utilizadores (separador "Utilizadores" do Admin).
//
// Lista todos os utilizadores da coleção `users` (admins + staff)
// e permite:
//   - Criar novo utilizador (email + password + role).
//     → Usa uma FIREBASE SECONDARY APP para contornar o problema
//       de createUserWithEmailAndPassword afetar a sessão atual
//       do admin. A app secundária é criada, faz signup, faz
//       signOut e é apagada — a sessão do admin na app principal
//       NÃO é terminada.
//   - Apagar utilizador (deleteUserProfile — apaga o perfil do
//     Firestore; a conta Auth fica órfã e precisa de ser apagada
//     manualmente em Firebase Console → Authentication).
//
// Notas:
//   - Só é visível se o utilizador logado for admin (ver Admin.jsx).
//   - Sem Cloud Functions (plano Spark): a eliminação definitiva da
//     conta Auth tem de ser manual.
// -------------------------------------------------------------

import { useState, useEffect } from "react";
import {
  UserPlus,
  Trash2,
  Shield,
  User as UserIcon,
  Mail,
  Lock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Crown,
  Info,
  Power,
  PowerOff,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeUsers,
  deleteUserProfile,
  setUserProfile,
  setUserActive,
} from "@/lib/db";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";

export default function UsersPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("staff");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Subscrição em tempo real à coleção users
  useEffect(() => {
    const unsubscribe = subscribeUsers((items) => {
      setUsers(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // === Criar utilizador via SECONDARY APP ===
  // Estratégia: inicializa uma app Firebase secundária com a mesma
  // config, usa o Auth dessa app para criar o novo user, faz signOut
  // da app secundária e apaga-a. A sessão do admin na app principal
  // NÃO é afetada.
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    setSuccessMessage("");

    if (!email || !password) {
      setFormError("Preenche email e password.");
      return;
    }
    if (password.length < 6) {
      setFormError("A password tem de ter pelo menos 6 caracteres.");
      return;
    }

    setCreating(true);
    let secondaryApp = null;
    try {

      // 1. Inicializa app secundária com nome único
      //    (deve ser único por chamada para evitar "app already exists")
      const secondaryAppName = `SecondaryApp-${Date.now()}`;
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);

      // 2. Cria o utilizador no Auth da app secundária
      //    Isto NÃO afeta a sessão do admin na app principal.
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );
      const newUid = cred.user.uid;

      // 3. Cria perfil no Firestore (usa a instância principal do db)
      await setUserProfile(newUid, { email, role });

      // 4. Faz signOut na app secundária (limpa o token localmente)
      try {
        await signOut(secondaryAuth);
      } catch (_) {
        // Já pode estar signed out se a operação foi síncrona
      }

      // 5. Apaga a app secundária para libertar recursos
      try {
        await deleteApp(secondaryApp);
        secondaryApp = null;
      } catch (err) {
      }

      setSuccessMessage(`Utilizador "${email}" criado com role "${role}".`);

      // Limpa form
      setEmail("");
      setPassword("");
      setRole("staff");
      setShowForm(false);

      // A lista atualiza automaticamente via subscribeUsers (onSnapshot)
    } catch (err) {
      const map = {
        "auth/email-already-in-use": "Já existe um utilizador com este email.",
        "auth/invalid-email": "Email inválido.",
        "auth/weak-password": "Password fraca (mínimo 6 caracteres).",
        "auth/operation-not-allowed":
          "Email/Password não está ativado no projeto Firebase. Ativa em Firebase Console → Authentication → Sign-in method.",
        "auth/app/delete-app": "Erro interno ao limpar app secundária. Tenta novamente.",
      };
      setFormError(map[err?.code] || err?.message || "Erro ao criar utilizador.");
    } finally {
      // Garantia: se a app secundária ainda existir, tenta apagar
      if (secondaryApp) {
        try { await deleteApp(secondaryApp); } catch (_) {}
      }
      setCreating(false);
    }
  };

  // === Apagar utilizador (apenas perfil do Firestore) ===
  const handleDelete = async (uid, emailToDelete, roleToDelete) => {
    if (uid === currentUser?.uid) {
      alert("Não podes apagar a tua própria conta.");
      return;
    }

    const confirmMsg =
      roleToDelete === "admin"
        ? `Apagar o ADMIN ${emailToDelete}?\n\n` +
          `O utilizador deixará de conseguir fazer login.\n\nConfirmar?`
        : `Apagar o utilizador ${emailToDelete}?\n\n` +
          `O utilizador deixará de conseguir fazer login.\n\nConfirmar?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteUserProfile(uid);
      setSuccessMessage(`Utilizador "${emailToDelete}" removido.`);
      setTimeout(() => setSuccessMessage(""), 4000);
    } catch (err) {
      alert(`Erro ao apagar: ${err?.message || ""}`);
    }
  };

  // === Ativar / Desativar utilizador ===
  // Em vez de apagar (que deixava conta Auth órfã), o admin pode
  // desativar: o user continua na coleção users mas `active=false`
  // → login é rejeitado pelo AuthContext com "Conta desativada".
  const handleToggleActive = async (uid, emailToToggle, currentActive) => {
    if (uid === currentUser?.uid) {
      alert("Não podes desativar a tua própria conta.");
      return;
    }

    const newActive = !currentActive;
    const action = newActive ? "ativar" : "desativar";

    if (!window.confirm(
      `${newActive ? "Ativar" : "Desativar"} o utilizador ${emailToToggle}?\n\n` +
        (newActive
          ? "O utilizador volta a conseguir fazer login normalmente."
          : "O utilizador deixa de conseguir fazer login.")
    )) return;

    try {
      await setUserActive(uid, newActive);
      // subscribeUsers atualiza a lista automaticamente.
    } catch (err) {
      alert(`Erro ao ${action}: ${err?.message || ""}`);
    }
  };

  // === Render ===

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">A carregar utilizadores...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">Utilizadores</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {users.length} utilizador{users.length !== 1 ? "es" : ""} ·{" "}
            {users.filter((u) => u.role === "admin").length} admin
            {users.filter((u) => u.role === "admin").length !== 1 ? "s" : ""} ·{" "}
            {users.filter((u) => u.role === "staff").length} staff
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Novo utilizador
        </button>
      </div>

      {/* Mensagem de sucesso (criação) */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-300 whitespace-pre-line flex-1">
            {successMessage}
          </p>
          <button
            onClick={() => setSuccessMessage("")}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg bg-secondary transition-colors flex-shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Formulário de criação */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3"
        >
          <h3 className="font-semibold text-sm">Criar novo utilizador</h3>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Mail className="w-3 h-3" /> Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@blive.pt"
              required
              autoFocus
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
              <Lock className="w-3 h-3" /> Password
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("staff")}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                  role === "staff"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/50 hover:border-primary/40"
                }`}
              >
                <UserIcon className={`w-4 h-4 ${role === "staff" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${role === "staff" ? "text-primary" : "text-foreground"}`}>
                    Staff
                  </p>
                  <p className="text-[10px] text-muted-foreground">Acesso ao /staff</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all ${
                  role === "admin"
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary/50 hover:border-primary/40"
                }`}
              >
                <Shield className={`w-4 h-4 ${role === "admin" ? "text-primary" : "text-muted-foreground"}`} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${role === "admin" ? "text-primary" : "text-foreground"}`}>
                    Admin
                  </p>
                  <p className="text-[10px] text-muted-foreground">Acesso total</p>
                </div>
              </button>
            </div>
          </div>

          {formError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{formError}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError("");
                setEmail("");
                setPassword("");
                setRole("staff");
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              {creating ? "A criar..." : "Criar utilizador"}
            </button>
          </div>
        </form>
      )}

      {/* Lista de utilizadores */}
      {users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card border border-dashed border-border/50 rounded-2xl">
          <p className="text-sm">Sem utilizadores.</p>
          <p className="text-xs mt-1 opacity-70">
            Clica em "Novo utilizador" para criar o primeiro admin.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isMe = u.uid === currentUser?.uid;
            const isAdmin = u.role === "admin";
            // `active` default true se for undefined (compat com perfis antigos)
            const isActive = u.active !== false;

            return (
              <div
                key={u.uid}
                className={`bg-card border rounded-2xl p-4 flex items-center gap-3 transition-opacity ${
                  !isActive ? "opacity-50 border-border/30" : isAdmin ? "border-primary/30" : "border-border/50"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isAdmin
                      ? "bg-primary/15 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {isAdmin ? (
                    <Crown className="w-5 h-5" />
                  ) : (
                    <UserIcon className="w-5 h-5" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate text-sm">{u.email}</p>
                    {isMe && (
                      <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-md font-medium">
                        tu
                      </span>
                    )}
                    {!isActive && (
                      <span className="text-[10px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-md font-medium">
                        inativo
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                        isAdmin
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {isAdmin ? "Admin" : "Staff"}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70">
                      UID: {u.uid?.slice(0, 12)}...
                    </span>
                  </div>
                </div>

                {/* Ações: toggle ativo + delete (com tooltip) */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Botão Ativar/Desativar */}
                  <button
                    onClick={() => handleToggleActive(u.uid, u.email, isActive)}
                    disabled={isMe}
                    title={
                      isMe
                        ? "Não podes desativar a tua própria conta"
                        : isActive
                        ? "Desativar utilizador (login é bloqueado)"
                        : "Ativar utilizador (login é permitido)"
                    }
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      isActive
                        ? "bg-green-500/10 text-green-400 hover:bg-red-500/15 hover:text-red-400"
                        : "bg-secondary text-muted-foreground hover:bg-green-500/15 hover:text-green-400"
                    }`}
                  >
                    {isActive ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>

                  {/* Botão Delete + tooltip */}
                  <div className="relative group">
                    <button
                      onClick={() => handleDelete(u.uid, u.email, u.role)}
                      disabled={isMe}
                      title={isMe ? "Não podes apagar a tua própria conta" : "Remover utilizador"}
                      className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
