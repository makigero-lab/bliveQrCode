import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
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
 * Usa:
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

  // Refs paralelos ao estado — usados pelo `login()` para aceder
  // ao valor mais recente de user/authError dentro da Promise
  // (sem stale closure). São atualizados em sync com o estado.
  const userRef = useRef(null);
  const authErrorRef = useRef(null);

  // Sempre que user/authError mudam, atualizamos os refs.
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  useEffect(() => {
    authErrorRef.current = authError;
  }, [authError]);

  // onAuthStateChanged: dispara uma vez na carga (mesmo que não
  // haja sessão) e depois sempre que há login/logout.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Sem sessão
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
        return;
      }

      // Há sessão Firebase Auth — ler perfil (role + active) no Firestore
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (!profile) {
          // Utilizador tem conta Auth mas não tem perfil na coleção
          // `users` — provavelmente foi apagado pelo admin. Faz logout.
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

        // Verifica se o utilizador está ativo. Se `active === false`,
        // o admin desativou-o — login é rejeitado.
        if (profile.active === false) {
          await signOut(auth);
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({
            type: "user_inactive",
            message:
              "A tua conta está desativada. Contacta o administrador do bar.",
          });
          setAuthChecked(true);
          setIsLoadingAuth(false);
          return;
        }

        setUser({
          uid: firebaseUser.uid,
          email: profile.email || firebaseUser.email,
          role: profile.role || "staff",
          active: profile.active !== false,
        });
        setIsAuthenticated(true);
        setAuthError(null);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      } catch (err) {
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
      unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------
  // Métodos
  // -------------------------------------------------------------

  /**
   * Faz login com email/password.
   *
   * Retorna uma Promise que só resolve DEPOIS de o onAuthStateChanged
   * disparar E o perfil (role, active) ser lido do Firestore. Isto
   * garante que quem chama `login()` recebe um user COM `role`
   * (não apenas o FirebaseUser básico) e pode redirecionar para a
   * rota certa (/admin vs /staff).
   *
   * Se o user estiver desativado (active=false) ou sem perfil, o
   * onAuthStateChanged faz signOut automático e o `login()` rejeita
   * com o erro correspondente.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{uid, email, role, active}>}
   * @throws {Error} com `code` do Firebase Auth (ex: "auth/invalid-credential")
   *                ou com `type` ("user_not_registered" | "user_inactive")
   */
  const login = useCallback((email, password) => {
    setAuthError(null);
    setIsLoadingAuth(true);

    return new Promise((resolve, reject) => {
      let settled = false;

      // Limpa os refs antes de começar para evitar detetar state
      // de uma sessão anterior.
      userRef.current = null;
      authErrorRef.current = null;

      // Timeout de 10s para não pendurar indefinidamente.
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("Timeout ao fazer login. Tenta novamente."));
        setIsLoadingAuth(false);
      }, 10000);

      // Polling dos refs (atualizados em sync com o estado pelo
      // useEffect acima). A cada 100ms verifica se o user já tem
      // role (sucesso) ou se authError foi setado (falha).
      const checkInterval = setInterval(() => {
        if (settled) return;

        const err = authErrorRef.current;
        const u = userRef.current;

        // Caso 1: login rejeitado pelo onAuthStateChanged.
        if (err && err.type) {
          settled = true;
          clearInterval(checkInterval);
          clearTimeout(timeout);
          setIsLoadingAuth(false);
          const e = new Error(err.message);
          e.type = err.type;
          reject(e);
          return;
        }

        // Caso 2: login OK — user com role disponível.
        if (u && u.role) {
          settled = true;
          clearInterval(checkInterval);
          clearTimeout(timeout);
          setIsLoadingAuth(false);
          resolve(u);
        }
      }, 100);

      // Inicia o signIn — o onAuthStateChanged vai disparar e
      // preencher o estado (user ou authError).
      signInWithEmailAndPassword(auth, email, password).catch((err) => {
        if (settled) return;
        settled = true;
        clearInterval(checkInterval);
        clearTimeout(timeout);
        setIsLoadingAuth(false);
        reject(err);
      });
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await signOut(auth);
      // onAuthStateChanged dispara com null → estado é limpo.
    } catch (err) {
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
    // 
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
