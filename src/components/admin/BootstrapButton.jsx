// src/components/admin/BootstrapButton.jsx
// -------------------------------------------------------------
// Botão de Bootstrap / Setup Inicial para o painel Admin.
//
// Verifica quais coleções do Firestore ainda estão vazias e
// permite criá-las a partir da UI:
//   • settings/bar (configuração padrão)
//   • tables (10 mesas com IDs seguros)
//   • products (150 produtos do catálogo B'Live)
//
// Não cria utilizadores — isso é feito no separador "Utilizadores".
// Para o primeiro admin, é mais simples usar o script CLI:
//   node scripts/bootstrap.js
// (porque criar user afeta a sessão atual do Firebase Auth).
// -------------------------------------------------------------

import { useState, useEffect } from "react";
import {
  Database,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PRODUCTS, normalizeProduct } from "@/data/catalog";

const COLLECTIONS = ["settings", "tables", "products", "users", "orders"];

function generateTableId() {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function BootstrapButton({ onSetupComplete }) {
  const [status, setStatus] = useState("idle"); // idle | checking | ready | setting | done | error
  const [counts, setCounts] = useState({});
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  // Verifica contagem de docs em cada coleção
  const checkCollections = async () => {
    setStatus("checking");
    setError("");
    const result = {};
    for (const col of COLLECTIONS) {
      try {
        const snap = await getDocs(collection(db, col));
        result[col] = snap.size;
      } catch (err) {
        console.warn(`[Bootstrap] Erro ao ler ${col}:`, err);
        result[col] = -1; // erro
      }
    }
    setCounts(result);
    setStatus("ready");
  };

  useEffect(() => {
    checkCollections();
  }, []);

  // Cria settings/bar
  const createSettings = async () => {
    setProgress("A criar settings/bar...");
    await setDoc(
      doc(db, "settings", "bar"),
      {
        bar_name: "B'Live Lounge Bar",
        primary_color: "#E91E8C",
        logo_url: null,
        tagline: "Cocktails • Shishas • Comida",
      },
      { merge: true }
    );
  };

  // Cria 10 mesas
  const createTables = async () => {
    setProgress("A criar 10 mesas...");
    const now = new Date().toISOString();
    const batch = writeBatch(db);
    for (let i = 1; i <= 10; i++) {
      const id = generateTableId();
      batch.set(doc(db, "tables", id), {
        table_number: String(i),
        created_date: now,
      });
    }
    await batch.commit();
  };

  // Popula products (150)
  const createProducts = async () => {
    setProgress(`A criar ${PRODUCTS.length} produtos...`);
    const now = new Date().toISOString();
    const BATCH_SIZE = 400;
    let currentBatch = writeBatch(db);
    let currentCount = 0;
    const batches = [];

    for (const p of PRODUCTS) {
      const slug = slugify(p.name);
      const ref = doc(collection(db, "products"));
      const normalized = normalizeProduct(p);
      currentBatch.set(ref, {
        ...normalized,
        slug,
        created_date: now,
        updated_date: now,
      });
      currentCount++;
      if (currentCount === BATCH_SIZE) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        currentCount = 0;
      }
    }
    if (currentCount > 0) batches.push(currentBatch);

    for (let i = 0; i < batches.length; i++) {
      setProgress(`A criar produtos (batch ${i + 1}/${batches.length})...`);
      await batches[i].commit();
    }
  };

  const handleSetup = async () => {
    const confirm = window.confirm(
      "Vou criar as coleções em falta no Firestore:\n\n" +
        "• settings/bar (configuração do bar)\n" +
        "• 10 mesas com IDs seguros para QR codes\n" +
        "• 150 produtos do catálogo B'Live\n\n" +
        "Não vou criar utilizadores — para o primeiro admin, " +
        "usa o script CLI:\n" +
        "node scripts/bootstrap.js\n\n" +
        "Continuar?"
    );
    if (!confirm) return;

    setStatus("setting");
    setError("");
    try {
      if ((counts.settings ?? 0) === 0) {
        await createSettings();
      }
      if ((counts.tables ?? 0) === 0) {
        await createTables();
      }
      if ((counts.products ?? 0) === 0) {
        await createProducts();
      }

      setProgress("");
      setStatus("done");
      if (typeof onSetupComplete === "function") {
        onSetupComplete();
      }
      // Recarrega contagens
      setTimeout(() => checkCollections(), 500);
    } catch (err) {
      console.error("[Bootstrap] Erro:", err);
      setError(err?.message || "Erro desconhecido.");
      setStatus("error");
    }
  };

  // === Render ===

  if (status === "checking") {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          A verificar coleções do Firestore...
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-green-400 text-sm">
            Setup concluído!
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Coleções criadas. Recarrega a página para ver os produtos/mesas.
          </p>
        </div>
        <button
          onClick={() => setStatus("ready")}
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
          <p className="font-semibold text-red-400 text-sm">Erro no setup</p>
          <p className="text-muted-foreground text-xs mt-0.5 whitespace-pre-line">
            {error}
          </p>
        </div>
        <button
          onClick={() => setStatus("ready")}
          className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors"
        >
          Fechar
        </button>
      </div>
    );
  }

  if (status === "setting") {
    return (
      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
        <p className="text-sm text-primary flex-1">{progress}</p>
      </div>
    );
  }

  // ready
  const missingCollections = Object.entries(counts).filter(
    ([, n]) => n === 0
  );
  const hasMissing = missingCollections.length > 0;

  return (
    <div className="bg-card border border-dashed border-primary/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm flex items-center gap-2">
            Setup inicial do Firestore
            {!hasMissing && (
              <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-medium">
                ✓ completo
              </span>
            )}
          </p>
          <p className="text-muted-foreground text-xs mt-0.5">
            Verifica e cria as coleções em falta (settings, tables, products).
          </p>
        </div>
        <button
          onClick={checkCollections}
          title="Reverificar"
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors flex-shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Lista de coleções com contagem */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
        {COLLECTIONS.map((col) => {
          const n = counts[col];
          const isOk = n > 0;
          return (
            <div
              key={col}
              className={`px-2 py-1.5 rounded-lg border flex items-center justify-between ${
                isOk
                  ? "bg-green-500/10 border-green-500/20"
                  : n === 0
                  ? "bg-yellow-500/10 border-yellow-500/30"
                  : "bg-red-500/10 border-red-500/30"
              }`}
            >
              <span className="font-mono">{col}</span>
              <span
                className={
                  isOk
                    ? "text-green-400 font-medium"
                    : n === 0
                    ? "text-yellow-400 font-medium"
                    : "text-red-400 font-medium"
                }
              >
                {n === -1 ? "erro" : n}
              </span>
            </div>
          );
        })}
      </div>

      {/* Ações */}
      {hasMissing ? (
        <button
          onClick={handleSetup}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Criar coleções em falta ({missingCollections.length})
        </button>
      ) : (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 text-xs text-green-400">
          ✅ Todas as coleções têm pelo menos 1 documento. A base de dados
          está pronta a usar.
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="bg-secondary/50 rounded-xl px-3 py-2 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground mb-1">
          Para criar o primeiro admin:
        </p>
        <p>
          O botão acima não cria utilizadores (criar user afeta a sessão
          atual do Firebase Auth). Usa o script CLI no terminal:
        </p>
        <pre className="mt-1 bg-background rounded px-2 py-1 text-[10px] font-mono overflow-x-auto">
{`node scripts/bootstrap.js`}
        </pre>
        <p className="mt-1">
          Ou cria manualmente em{" "}
          <a
            href="https://console.firebase.google.com/project/autocell-535c2/authentication/users"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Firebase Console → Authentication
          </a>{" "}
          e depois adiciona um documento em{" "}
          <code className="text-primary font-mono">users/</code> com a role
          "admin".
        </p>
      </div>
    </div>
  );
}
