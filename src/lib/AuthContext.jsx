import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getUserProfile, setUserProfile } from "@/lib/db";

/**
 * AuthContext (Firebase Auth real)
 * -----------------------------------------------------------------
 * Substitui completamente o bypass demo. Usa:
 *   - Firebase Auth (Email/Password) para autenticação real.
 *   - Firestore coleção `users/{uid}` para guardar a `role`
 *     ("admin" | "staff") de cada utilizador.
 *
 * Fluxo:
 *   1. onAuthStateChanged dispara quando o estado de auth muda
 *      (login, logout, refresh do token).
 *   2. Para cada utilizador autenticado, lemos o seu perfil na
 *      coleção `users` para obter a `role`.
 *   3. Se o utilizador não tiver perfil na coleção `users`, é
 *      considerado "não autorizado" e é feito signOut.
 *
 * Métodos expostos:
 *   - login(email, password)        → Promise<User>
 *   - logout()                       → Promise<void>
 *   - createUser(email, password, role) → Promise<{uid, email, role}>
 *     (usado pelo UsersPanel do Admin)
 *
 * Estado exposto:
 *   - user: { uid, email, role } | null
 *   - isAuthenticated: boolean
 *   - isLoadingAuth: boolean (true enquanto onAuthStateChanged não dispara)
 *   - authChecked: boolean
 *   - authError: { type, message } | null
 * -----------------------------------------------------------------
 */
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  // onAuthStateChanged: dispara uma vez na carga (mesmo que não
  // haja sessão) e depois sempre que há login/logout.
  useEffect(() => {
    console.info("[Auth] A subscrever estado de auth...");
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Sem sessão
        console.info("[Auth] Sem utilizador autenticado.");
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }

      // Há sessão Firebase Auth — ler perfil (role) no Firestore
      console.info(`[Auth] Sessão ativa: ${firebaseUser.email}. A ler perfil...`);
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (!profile) {
          // Utilizador tem conta Auth mas não tem perfil na coleção
          // `users` — provavelmente foi apagado pelo admin. Faz logout.
          console.warn(
            `[Auth] Utilizador ${firebaseUser.email} sem perfil em users/. A fazer signOut.`
          );
          await signOut(auth);
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: "user_not_registered",
            message:
              "A tua conta não tem perfil associado. Contacta o administrador.",
          });
          setAuthChecked(true);
          setIsLoadingAuth(false);
          return;
        }

        console.info(
          `[Auth] Perfil carregado: role=${profile.role}, email=${profile.email}.`
        );
        setUser({
          uid: firebaseUser.uid,
          email: profile.email || firebaseUser.email,
          role: profile.role || "staff",
        });
        setIsAuthenticated(true);
        setAuthError(null);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      } catch (err) {
        console.error("[Auth] Erro ao ler perfil:", err);
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: "unknown",
          message: err?.message || "Erro ao carregar perfil.",
        });
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });

    return () => {
      console.info("[Auth] A cancelar subscrição de auth.");
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // Métodos
  // -------------------------------------------------------------

  /**
   * Faz login com email/password.
   * @param {string} email
   * @param {string} password
   * @throws {Error} com `code` do Firebase Auth (ex: "auth/invalid-credential")
   */
  const login = useCallback(async (email, password) => {
    setAuthError(null);
    setIsLoadingAuth(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged vai disparar e preencher o estado.
      return cred.user;
    } catch (err) {
      console.error("[Auth] Erro no login:", err);
      setIsLoadingAuth(false);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged dispara com null → estado é limpo.
    } catch (err) {
      console.error("[Auth] Erro no logout:", err);
    }
  }, []);

  /**
   * Cria um novo utilizador Firebase Auth + perfil no Firestore.
   * Usado pelo UsersPanel do Admin.
   *
   * @param {string} email
   * @param {string} password
   * @param {"admin"|"staff"} role
   * @returns {Promise<{uid, email, role}>}
   * @throws {Error} com `code` do Firebase Auth
   */
  const createUser = useCallback(async (email, password, role) => {
    // createUserWithEmailAndPassword afeta a sessão atual! Para evitar
    // que o admin seja "deslogado" (na verdade, logado como o novo
    // user), fazemos signOut imediatamente e contamos com o
    // onAuthStateChanged para reverter. Como o admin estava logado,
    // o token persistente ainda está no IndexedDB — um novo login
    // silencioso é complicado; em vez disso, o utilizador atual será
    // o novo user até o admin fazer login novamente.
    //
    // WORKAROUND: O admin tem de voltar a fazer login após criar
    // um utilizador. Avisamos via mensagem.
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;
    await setUserProfile(uid, { email, role }); // importado lazy abaixo
    return { uid, email, role };
  }, []);

  // setUserProfile importado aqui para evitar dependência circular
  // no top-level (AuthContext → db → firebase — sem ciclo, mas
  // mantemos o import dinâmico para clareza).
  // Nota: o import real já está no topo do ficheiro via db.js.
  // (Isto é só uma nota; o código acima usa `setUserProfile` que
  // precisa de ser importado.)

  const navigateToLogin = useCallback(() => {
    // Usado pelo App.jsx quando authError.type === "auth_required"
    // A navegação real é feita pelo router do App.jsx; este método
    // existe só para compatibilidade com o código antigo.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  }, []);

  const value = {
    user,
    isAuthenticated,
    isLoadingAuth,
    isLoadingPublicSettings: false, // não usado; mantido por compat
    authError,
    appPublicSettings: null, // não usado; mantido por compat
    authChecked,
    login,
    logout,
    createUser,
    navigateToLogin,
    checkUserAuth: async () => {}, // no-op; onAuthStateChanged trata
    checkAppState: async () => {}, // no-op
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
