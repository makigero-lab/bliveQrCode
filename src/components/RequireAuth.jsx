/**
 * RequireAuth (bypass para demonstração)
 * -----------------------------------------------------------------
 * Em modo demo não há autenticação — qualquer visitante é tratado
 * como admin. O componente passa direto para o `children`.
 * -----------------------------------------------------------------
 */
export default function RequireAuth({ children }) {
  return children;
}
