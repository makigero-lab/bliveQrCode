// src/components/admin/ImportCatalogButton.jsx
// -------------------------------------------------------------
// Botão "Importar Catálogo" para o painel de Admin.
//
// Lê o array de produtos de `src/data/catalog.js` (150 produtos
// extraídos das 3 cartas do B'Live Lounge Bar) e envia cada um
// para a coleção `products` no Firestore via `setDoc` (com id
// estável baseado em slug) ou `addDoc` (id automático).
//
// Estratégia:
//   - Usa `setDoc` com id derivado do slug do nome do produto.
//   - Isto torna o import IDEMPOTENTE: correr várias vezes não
//     cria duplicados (apenas sobrescreve o mesmo documento).
//   - Cada produto é normalizado via `normalizeProduct()` para
//     garantir que tem todos os campos esperados pelo modelo:
//     `name`, `description`, `price`, `category`, `image_url`,
//     `available`, `stock_enabled`, `stock`.
//
// UX:
//   - Botão com estado idle / importing / done / error.
//   - Mostra progresso (X / N) durante o import.
//   - Toast de sucesso/erro no fim.
// -------------------------------------------------------------

import { useState, useRef } from "react";
import { Database, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { collection, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  PRODUCTS,
  normalizeProduct,
  CATALOG_TOTAL,
} from "@/data/catalog";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function ImportCatalogButton({ onImported }) {
  const [status, setStatus] = useState("idle"); // idle | importing | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [message, setMessage] = useState("");
  const [createdCount, setCreatedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const cancelRef = useRef(false);

  const handleImport = async () => {
    if (status === "importing") return;

    const confirm = window.confirm(
      `Vais importar ${CATALOG_TOTAL} produtos do catálogo B'Live para o Firestore.\n\n` +
        `Os produtos são gravados com id = slug(nome) por isso o import é IDEMPOTENTE:\n` +
        `produtos já existentes serão atualizados, novos serão criados.\n\n` +
        `Continuar?`
    );
    if (!confirm) return;

    setStatus("importing");
    setProgress({ current: 0, total: CATALOG_TOTAL });
    setMessage("");
    setCreatedCount(0);
    setUpdatedCount(0);
    cancelRef.current = false;

    let created = 0;
    let updated = 0;
    let errors = 0;
    const now = new Date().toISOString();

    try {
      // Pré-carrega ids existentes para distinguir create vs update
      const existingSnap = await getDocs(collection(db, "products"));
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));

      for (let i = 0; i < PRODUCTS.length; i++) {
        if (cancelRef.current) {
          setMessage("Import cancelado pelo utilizador.");
          break;
        }

        const raw = PRODUCTS[i];
        const normalized = normalizeProduct(raw);
        const slug = slugify(normalized.name);
        const docId = `prod-${slug}`;

        const payload = {
          ...normalized,
          slug,
          created_date: existingIds.has(docId)
            ? existingSnap.docs.find((d) => d.id === docId).data().created_date || now
            : now,
          updated_date: now,
        };

        try {
          // setDoc com id estável (idempotente)
          await setDoc(doc(db, "products", docId), payload, { merge: true });
          if (existingIds.has(docId)) {
            updated++;
          } else {
            created++;
          }
        } catch (err) {
          console.error(`[ImportCatalog] Erro no produto "${raw.name}":`, err);
          errors++;
        }

        setProgress({ current: i + 1, total: CATALOG_TOTAL });
        // Pequena pausa a cada 20 produtos para não estourar a quota
        if ((i + 1) % 20 === 0) {
          await new Promise((r) => setTimeout(r, 100));
        }
      }

      setCreatedCount(created);
      setUpdatedCount(updated);

      if (errors > 0) {
        setStatus("error");
        setMessage(
          `Import concluído com ${errors} erro(s). ${created} criados, ${updated} atualizados.`
        );
      } else if (cancelRef.current) {
        setStatus("idle");
      } else {
        setStatus("done");
        setMessage(
          `${created} produtos criados, ${updated} atualizados. Catálogo sincronizado com o Firestore!`
        );
      }

      // Callback para o Admin.jsx recarregar a lista
      if (typeof onImported === "function") {
        onImported();
      }
    } catch (err) {
      console.error("[ImportCatalog] Erro geral:", err);
      setStatus("error");
      setMessage(
        `Erro ao importar: ${err.message || "verifica a consola para detalhes."}`
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
  };

  // Estados visuais
  if (status === "done") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-400 text-sm">Import concluído!</p>
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
          <p className="font-semibold text-red-400 text-sm">Erro no import</p>
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

  if (status === "importing") {
    const pct = progress.total
      ? Math.round((progress.current / progress.total) * 100)
      : 0;
    return (
      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-primary text-sm">
              A importar catálogo... {progress.current} / {progress.total}
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
            className="h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // idle
  return (
    <div className="bg-card border border-dashed border-primary/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">
            Importar catálogo B'Live ({CATALOG_TOTAL} produtos)
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Lê o catálogo local ({`src/data/catalog.js`}) e envia para o Firestore.
            Idempotente: não cria duplicados.
          </p>
        </div>
      </div>
      <button
        onClick={handleImport}
        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors flex-shrink-0"
      >
        <Database className="w-4 h-4" />
        Importar Catálogo
      </button>
    </div>
  );
}
