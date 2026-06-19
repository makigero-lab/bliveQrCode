import React, { createContext, useContext } from "react";

/**
 * AuthContext (bypass para demonstração)
 * -----------------------------------------------------------------
 * Para evitar problemas de bloqueio na apresentação, ignoramos
 * completamente a autenticação. O utilizador é sempre considerado
 * autenticado como admin (role: "admin"), com isLoadingAuth:false
 * desde o primeiro render.
 *
 * Isto permite que /admin e /staff sejam acedidos sem qualquer
 * friction. Se no futuro for necessário reintroduzir auth real
 * (Firebase Auth, Supabase, etc.), basta reimplementar os métodos
 * `logout`, `navigateToLogin` e o estado `user`.
 * -----------------------------------------------------------------
 */
const AuthContext = createContext();

const MOCK_USER = {
  id: "demo-admin",
  name: "Administrador (demo)",
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
  // Estado fixo — sempre autenticado como admin, sem loading.
  const value = {
    user: MOCK_USER,
    isAuthenticated: true,
    isLoadingAuth: false,
    isLoadingPublicSettings: false,
    authError: null,
    appPublicSettings: MOCK_PUBLIC_SETTINGS,
    authChecked: true,
    logout: () => {
      // no-op em modo demo
    },
    navigateToLogin: () => {
      // no-op em modo demo
    },
    checkUserAuth: async () => {},
    checkAppState: async () => {},
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
