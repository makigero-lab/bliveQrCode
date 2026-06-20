// src/components/admin/ClearAllOrdersButton.jsx
// -------------------------------------------------------------
// Botão "Limpar Mesas Esquecidas (Abertas)" para o painel de Admin
// (separador Pedidos).
//
// Apaga EXCLUSIVAMENTE os documentos da coleção `orders` que tenham
// tab_status: 'open'. O histórico de contas fechadas (tab_status:
// 'closed') NÃO é afetado — preserva os dados para contabilidade.
//
// Útil no final do turno para limpar mesas que ficaram abertas
// por engano (cliente saiu sem pagar, staff esqueceu de fechar).
// -------------------------------------------------------------

import { useState, useRef } from "react";
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  collection,
  writeBatch,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ClearAllOrdersButton({ onCleared }) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState("");
  const cancelRef = useRef(false);

  const handleClear = async () => {
    if (status === "deleting") return;

    const firstConfirm = window.confirm(
      "⚠️  ATENÇÃO\n\n" +
        "Vais apagar TODOS os pedidos com tab_status='open' (mesas abertas).\n\n" +
        "As contas fechadas (histórico) NÃO serão afetadas — estão seguras.\n\n" +
        "Usa isto no final do turno para limpar mesas esquecidas.\n\n" +
        "Queres continuar?"
    );
    if (!firstConfirm) return;

    const typed = window.prompt(
      "Para confirmares, escreve APAGAR em maiúsculas:"
    );
    if (typed !== "APAGAR") {
      window.alert("Confirmação cancelada — palavra-chave incorreta.");
      return;
    }

    setStatus("deleting");
    setProgress({ current: 0, total: 0 });
    setMessage("");
    cancelRef.current = false;

    try {
      // Apaga APENAS pedidos com tab_status="open" — preserva histórico
      const q = query(
        collection(db, "orders"),
        where("tab_status", "==", "open")
      );
      const snap = await getDocs(q);
      const total = snap.size;
      setProgress({ current: 0, total });

      if (total === 0) {
        setStatus("done");
        setMessage("Não há mesas abertas — tudo limpo.");
        if (typeof onCleared === "function") onCleared();
        return;
      }

      const allDocs = snap.docs;
      const BATCH_SIZE = 400;
      let deleted = 0;

      for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
        if (cancelRef.current) {
          setMessage("Operação cancelada pelo utilizador.");
          break;
        }

        const slice = allDocs.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        slice.forEach((d) => batch.delete(d.ref));
        await batch.commit();

        deleted += slice.length;
        setProgress({ current: deleted, total });
      }

      if (cancelRef.current) {
        setStatus("idle");
        setMessage(`Cancelado. ${deleted} de ${total} mesas limpas.`);
      } else {
        setStatus("done");
        setMessage(`${deleted} mesas abertas limpas. Histórico preservado.`);
      }

      if (typeof onCleared === "function") onCleared();
    } catch (err) {
      setStatus("error");
      setMessage(`Erro ao limpar: ${err.message || ""}`);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleReset = () => {
    setStatus("idle");
    setMessage("");
    setProgress({ current: 0, total: 0 });
  };

  if (status === "done") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-400 text-sm">Operação concluída!</p>
          <p className="text-muted-foreground text-xs mt-0.5">{message}</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-400 text-sm">Erro ao limpar</p>
          <p className="text-muted-foreground text-xs mt-0.5">{message}</p>
        </div>
        <button
          onClick={handleReset}
          className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (status === "deleting") {
    const pct = progress.total
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="w-5 h-5 text-red-400 animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-400 text-sm">
              A limpar mesas abertas... {progress.current} / {progress.total}
            </p>
            <p className="text-muted-foreground text-xs">
              Por favor não feches esta página.
            </p>
          </div>
          <button
            onClick={handleCancel}
            className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors"
          >
            Cancelar
          </button>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-red-400 rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className="bg-card border border-dashed border-yellow-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 text-yellow-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            Limpar Mesas Esquecidas (Abertas)
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Apaga apenas pedidos com conta aberta. O histórico de contas
            fechadas é preservado.
          </p>
        </div>
      </div>
      <button
        onClick={handleClear}
        className="flex items-center justify-center gap-2 bg-yellow-500/90 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-yellow-500 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
        Limpar Mesas Abertas
      </button>
    </div>
  );
}
