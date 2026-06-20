// src/components/admin/ClearAllProductsButton.jsx
// -------------------------------------------------------------
// Botão "Apagar todos os produtos" para o painel de Admin.
//
// Lê todos os documentos da coleção `products` no Firestore e
// apaga-os um a um via `deleteDoc`. Útil para resets rápidos antes
// de reimportar o catálogo.
//
// Estratégia:
//   - Usa `getDocs(collection(db,"products"))` para listar tudo.
//   - Faz loop com `deleteDoc(doc.ref)` para cada documento.
//   - Em lotes de 400, usa `writeBatch` para evitar quotas.
//
// UX:
//   - Botão com estado idle / confirming / deleting / done / error.
//   - Dupla confirmação (botão → dialog → "Sim, apagar tudo")
//     porque a operação é destrutiva e irreversível.
//   - Mostra progresso (X / N) durante a eliminação.
//   - Toast de sucesso/erro no fim.
// -------------------------------------------------------------

import { useState, useRef } from "react";
import {
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  writeBatch,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function ClearAllProductsButton({ onCleared }) {
  const [status, setStatus] = useState("idle"); // idle | deleting | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [deletedCount, setDeletedCount] = useState(0);
  const cancelRef = useRef(false);

  const handleClear = async () => {
    if (status === "deleting") return;

    // Dupla confirmação: primeira janela
    const firstConfirm = window.confirm(
      "⚠️  ATENÇÃO\n\n" +
        "Estás prestes a apagar TODOS os produtos da coleção `products` " +
        "no Firestore.\n\n" +
        "Esta operação é IRREVERSÍVEL. Todos os produtos desaparecem do " +
        "menu e do painel de admin.\n\n" +
        "Para reverter terás de voltar a clicar em \"Importar Catálogo\" " +
        "ou em adicionar produtos manualmente.\n\n" +
        "Queres continuar?"
    );
    if (!firstConfirm) return;

    // Segunda confirmação: o utilizador tem de escrever "APAGAR"
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
    setDeletedCount(0);
    cancelRef.current = false;

    try {
      const snap = await getDocs(collection(db, "products"));
      const total = snap.size;
      setProgress({ current: 0, total });

      if (total === 0) {
        setStatus("done");
        setMessage("A coleção `products` já estava vazia.");
        if (typeof onCleared === "function") onCleared();
        return;
      }

      // Agrupa em batches de 400 (limite Firestore é 500 ops/batch)
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
        setDeletedCount(deleted);
        setProgress({ current: deleted, total });
      }

      if (cancelRef.current) {
        setStatus("idle");
        setMessage(`Cancelado. ${deleted} de ${total} produtos apagados.`);
      } else {
        setStatus("done");
        setMessage(`${deleted} produtos apagados da coleção \`products\`.`);
      }

      if (typeof onCleared === "function") onCleared();
    } catch (err) {
      setStatus("error");
      setMessage(
        `Erro ao apagar produtos: ${err.message ||
          "verifica a consola para detalhes."}`
      );
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  const handleReset = () => {
    setStatus("idle");
    setMessage("");
    setProgress({ current: 0, total: 0 });
    setDeletedCount(0);
  };

  // Estado: done
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

  // Estado: error
  if (status === "error") {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-red-400 text-sm">Erro ao apagar</p>
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

  // Estado: deleting
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
              A apagar produtos... {progress.current} / {progress.total}
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

  // Estado: idle
  return (
    <div className="bg-card border border-dashed border-red-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            Apagar todos os produtos
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Remove TODOS os documentos da coleção <code className="text-red-400 font-mono">products</code>.
            Irreversível. Usa antes de reimportar o catálogo.
          </p>
        </div>
      </div>
      <button
        onClick={handleClear}
        className="flex items-center justify-center gap-2 bg-red-500/90 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-red-500 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-4 h-4" />
        Apagar tudo
      </button>
    </div>
  );
}
