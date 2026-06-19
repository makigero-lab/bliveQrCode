import { useEffect, useState } from "react";

/**
 * RequireAuth (modo Mock)
 * -----------------------------------------------------------------
 * Em modo Mock não há autenticação externa (Base44) — todos os
 * utilizadores são tratados como admin local. Este componente
 * mantém-se para preservar a estrutura de rotas, mas deixa passar
 * qualquer visitante após um loading mínimo (para evitar flashes
 * de UI).
 * -----------------------------------------------------------------
 */
export default function RequireAuth({ children }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Pequeno delay para o spinner aparecer e dar feedback visual.
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return children;
}
