import React, { createContext, useState, useContext, useEffect } from "react";

/**
 * AuthContext (modo Mock)
 * -----------------------------------------------------------------
 * Versão simplificada do AuthContext original. A versão antiga fazia
 * uma chamada HTTP a `/api/apps/public/prod/public-settings/by-id/...`
 * que dependia do backend Base44 e crashava em produção (Vercel).
 *
 * Em modo Mock não há autenticação real: consideramos o utilizador
 * sempre autenticado como admin local, de forma a que as rotas
 * protegidas (`/admin`, `/staff`) continuem acessíveis.
 * -----------------------------------------------------------------
 */
const AuthContext = createContext();

const MOCK_USER = {
  id: "mock-user-1",
  name: "Utilizador Local",
  email: "admin@blive.local",
  role: "admin",
};

const MOCK_PUBLIC_SETTINGS = {
  id: "mock-app",
  public_settings: {
    bar_name: "B'Live Lounge Bar",
  },
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // Simula latência mínima para o spinner de loading aparecer.
      await new Promise((r) => setTimeout(r, 80));

      if (cancelled) return;

      setAppPublicSettings(MOCK_PUBLIC_SETTINGS);
      setIsLoadingPublicSettings(false);

      setUser(MOCK_USER);
      setIsAuthenticated(true);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    };

    init();

    return () => {
      cancelled = true;
    };
  }, []);

  const checkUserAuth = async () => {
    setUser(MOCK_USER);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setIsLoadingAuth(false);
  };

  const checkAppState = async () => {
    setAppPublicSettings(MOCK_PUBLIC_SETTINGS);
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const logout = () => {
    // Em modo Mock o logout é no-op: o utilizador continua autenticado.
    setUser(null);
    setIsAuthenticated(false);
  };

  const navigateToLogin = () => {
    // No-op em modo Mock.
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
