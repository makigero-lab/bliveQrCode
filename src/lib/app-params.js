/**
 * app-params (modo Mock)
 * -----------------------------------------------------------------
 * Originalmente este módulo lia parâmetros da Base44 (app_id,
 * access_token, functions_version, app_base_url) a partir de env
 * vars (`VITE_BASE44_*`), query string e localStorage.
 *
 * Como a dependência da Base44 foi removida, o módulo mantém a mesma
 * API exportada (para não partir imports existentes) mas devolve
 * valores neutros por defeito.
 *
 * Ainda são suportados os parâmetros `app_id` e `access_token` via
 * URL/localStorage para retrocompatibilidade, mas não são usados por
 * nenhum componente ativo.
 * -----------------------------------------------------------------
 */
const isNode = typeof window === "undefined";
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase();

const getAppParamValue = (
  paramName,
  { defaultValue = undefined, removeFromUrl = false } = {}
) => {
  if (isNode) return defaultValue;
  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);
  if (removeFromUrl) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${
      urlParams.toString() ? `?${urlParams.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }
  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = storage.getItem(storageKey);
  if (storedValue) return storedValue;
  return null;
};

const getAppParams = () => {
  if (getAppParamValue("clear_access_token") === "true") {
    storage.removeItem("base44_access_token");
    storage.removeItem("token");
  }
  return {
    // Em modo Mock os valores Base44 não são necessários.
    // Mantemos as chaves por retrocompatibilidade de API.
    appId: getAppParamValue("app_id", {
      defaultValue: "blive-mock-app",
    }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", {
      defaultValue: isNode ? null : window.location.href,
    }),
    functionsVersion: null,
    appBaseUrl: null,
  };
};

export const appParams = {
  ...getAppParams(),
};
