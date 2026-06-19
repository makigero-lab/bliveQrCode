// src/components/admin/UsersPanel.jsx
// -------------------------------------------------------------
// Gestão de Utilizadores (separador "Utilizadores" do Admin).
//
// Lista todos os utilizadores da coleção `users` (admins + staff)
// e permite:
//   - Criar novo utilizador (email + password + role).
//     → createUserWithEmailAndPassword (Firebase Auth) + setUserProfile.
//   - Apagar utilizador (deleteUserProfile — apaga o perfil do
//     Firestore; a conta Auth fica órfã mas sem perfil = login falha).
//
// Notas:
//   - Só é visível se o utilizador logado for admin (ver Admin.jsx).
//   - A criação de utilizadores afecta a sessão atual do admin
//     (limitação do Firebase Auth client-side). Por isso o admin
//     precisa de voltar a fazer login após criar um user. Isto é
//     mostrado como aviso claramente.
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
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import {
  subscribeUsers,
  deleteUserProfile,
  setUserProfile,
} from "@/lib/db";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function UsersPanel() {
  const { user: currentUser, logout } = useAuth();
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
    try {
      console.info(`[UsersPanel] A criar utilizador ${email} (role=${role})...`);

      // ATENÇÃO: createUserWithEmailAndPassword afeta a sessão atual!
      // O admin será deslogado (na verdade, logado como o novo user).
      // Verificamos isto no fim e fazemos signOut manual + mensagem.
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const newUid = cred.user.uid;

      // Cria perfil no Firestore
      await setUserProfile(newUid, { email, role });

      console.info(`[UsersPanel] Utilizador ${email} criado com uid=${newUid}.`);

      // AVISO: a partir daqui, a sessão atual mudou para o novo user.
      // O onAuthStateChanged disparou e o AuthContext já deve ter
      // atualizado o estado para o novo user. Fazemos signOut e
      // avisamos o admin para voltar a fazer login.
      await auth.signOut();

      setSuccessMessage(
        `✅ Utilizador "${email}" criado com role "${role}".\n\n` +
          `⚠️ Por segurança, a tua sessão foi terminada. Volta a fazer login ` +
          `com a tua conta de admin para continuar.`
      );

      // Limpa form
      setEmail("");
      setPassword("");
      setRole("staff");
      setShowForm(false);

      // Após 4 segundos, faz logout via contexto (redireciona para /login)
      setTimeout(() => {
        if (logout) logout();
      }, 4000);
    } catch (err) {
      console.error("[UsersPanel] Erro ao criar utilizador:", err);
      const map = {
        "auth/email-already-in-use": "Já existe um utilizador com este email.",
        "auth/invalid-email": "Email inválido.",
        "auth/weak-password": "Password fraca (mínimo 6 caracteres).",
        "auth/operation-not-allowed":
          "Email/Password não está ativado no projeto Firebase. Ativa em Firebase Console → Authentication → Sign-in method.",
      };
      setFormError(map[err?.code] || err?.message || "Erro ao criar utilizador.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (uid, emailToDelete, roleToDelete) => {
    if (uid === currentUser?.uid) {
      alert("Não podes apagar a tua própria conta.");
      return;
    }

    const confirmMsg =
      roleToDelete === "admin"
        ? `Apagar o ADMIN ${emailToDelete}?\n\n` +
          `O perfil é removido do Firestore. A conta Auth continua a existir ` +
          `mas sem perfil → login falha.\n\n` +
          `Para apagar completamente (incluindo a conta Auth), usa o Firebase Console.\n\n` +
          `Confirmar?`
        : `Apagar o utilizador ${emailToDelete}?\n\n` +
          `O perfil é removido do Firestore. A conta Auth continua a existir ` +
          `mas sem perfil → login falha.\n\n` +
          `Confirmar?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteUserProfile(uid);
      console.info(`[UsersPanel] Perfil ${emailToDelete} apagado.`);
    } catch (err) {
      console.error("[UsersPanel] Erro ao apagar:", err);
      alert(`Erro ao apagar: ${err?.message || ""}`);
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

          {/* Aviso sobre signOut */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-300">
              <strong>Atenção:</strong> após criares o utilizador, a tua sessão
              será terminada por segurança. Volta a fazer login com a tua conta
              de admin.
            </p>
          </div>

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

            return (
              <div
                key={u.uid}
                className={`bg-card border rounded-2xl p-4 flex items-center gap-3 ${
                  isAdmin ? "border-primary/30" : "border-border/50"
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

                {/* Ações */}
                <button
                  onClick={() => handleDelete(u.uid, u.email, u.role)}
                  disabled={isMe}
                  title={isMe ? "Não podes apagar a tua própria conta" : "Apagar utilizador"}
                  className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box sobre limitação do Firebase Auth */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-xs text-muted-foreground">
        <p className="font-medium text-primary mb-1">ℹ️ Sobre a gestão de utilizadores</p>
        <p>
          A criação de utilizadores usa o Firebase Auth (Email/Password). Por
          limitações do SDK client-side, criar um novo utilizador termina a
          sessão do admin atual — por isso é pedido que voltes a fazer login.
        </p>
        <p className="mt-2">
          Apagar um utilizador remove apenas o seu perfil do Firestore. A
          conta Auth fica órfã (sem perfil = login falha). Para apagar
          completamente a conta Auth, usa o{" "}
          <a
            href="https://console.firebase.google.com/project/autocell-535c2/authentication/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Firebase Console → Authentication
          </a>
          .
        </p>
        <p className="mt-2">
          As regras de segurança do Firestore devem permitir leitura/escrita
          em <code className="text-primary font-mono">users/*</code> apenas
          para utilizadores autenticados com role "admin".
        </p>
      </div>
    </div>
  );
}
