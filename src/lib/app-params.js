/**
 * app-params (legacy)
 * -----------------------------------------------------------------
 * Após a migração para Firebase, este módulo já não é usado por
 * nenhum componente ativo. Mantém-se exportado por segurança, mas
 * devolve valores neutros. Pode ser removido numa futura limpeza.
 * -----------------------------------------------------------------
 */
export const appParams = {
  appId: "blive-firebase",
  token: null,
  fromUrl: typeof window !== "undefined" ? window.location.href : null,
  functionsVersion: null,
  appBaseUrl: null,
};
