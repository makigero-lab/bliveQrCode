// src/components/admin/BulkProductEditor.jsx
// -------------------------------------------------------------
// Editor visual em massa para produtos do catálogo.
//
// Permite ao admin editar qualquer produto do Firestore SEM mexer
// no código — incluindo trocar os placeholders da Unsplash por
// URLs de fotos reais (ex.: do Instagram do B'Live Lounge Bar).
//
// Funcionalidades:
//   - Lista todos os produtos da coleção `products`.
//   - Filtro por categoria + pesquisa por nome.
//   - Edição inline de TODOS os campos:
//       name, description, price, category, image_url,
//       available, stock_enabled, stock
//   - Botão "Guardar" em cada linha faz `setDoc` (merge) no
//     documento correspondente.
//   - Preview da imagem em tempo real quando se edita o `image_url`.
//   - Estado visual: idle / dirty / saving / saved / error.
//   - Botão "Guardar tudo" para persistir todas as linhas alteradas
//     de uma só vez (em batches de 400 via writeBatch).
//
// Use case principal: trocar placeholders Unsplash por fotos reais
// do Instagram do B'Live. Basta colar o URL da foto no campo
// `image_url` e clicar em Guardar.
// -------------------------------------------------------------

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import { collection, doc, writeBatch, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { listProducts } from "@/lib/db";
import { CATEGORIES } from "@/data/catalog";

const CATEGORY_LABELS = {
  cocktails: "Cocktails",
  bebidas: "Bebidas",
  comida: "Comida",
  sobremesas: "Sobremesas",
  shisha: "Shisha",
};

export default function BulkProductEditor() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingError, setLoadingError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("todos");
  // Mapa de edições por id: { [id]: { ...camposAlterados } }
  const [drafts, setDrafts] = useState({});
  // Mapa de estado de gravação por id: idle|saving|saved|error
  const [saveStates, setSaveStates] = useState({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadingError("");
    try {
      const data = await listProducts();
      setProducts(data);
    } catch (err) {
      setLoadingError("Não foi possível carregar os produtos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Lista filtrada
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "todos" && p.category !== categoryFilter)
        return false;
      if (s) {
        const haystack = `${p.name || ""} ${p.description || ""}`.toLowerCase();
        if (!haystack.includes(s)) return false;
      }
      return true;
    });
  }, [products, search, categoryFilter]);

  // Conta edits pendentes
  const dirtyCount = Object.keys(drafts).filter((id) =>
    products.some((p) => p.id === id)
  ).length;

  // Helpers de edição
  const updateDraft = (id, field, value) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    // limpa estado de "saved" anterior
    setSaveStates((prev) => ({ ...prev, [id]: "idle" }));
  };

  const getFieldValue = (product, field) => {
    const draft = drafts[product.id];
    if (draft && field in draft) return draft[field];
    return product[field];
  };

  const isDirty = (id) => Boolean(drafts[id]);

  // Grava um único produto
  const saveOne = async (id) => {
    const draft = drafts[id];
    if (!draft) return;
    const original = products.find((p) => p.id === id);
    if (!original) return;

    setSaveStates((prev) => ({ ...prev, [id]: "saving" }));

    try {
      // Merge do draft com o original + updated_date
      const patch = {
        ...draft,
        // conversões de tipo seguras
        price: Number(draft.price ?? original.price) || 0,
        stock: Number(draft.stock ?? original.stock) || 0,
        available: Boolean(
          draft.available !== undefined ? draft.available : original.available
        ),
        stock_enabled: Boolean(
          draft.stock_enabled !== undefined
            ? draft.stock_enabled
            : original.stock_enabled
        ),
        updated_date: new Date().toISOString(),
      };

      await setDoc(doc(db, "products", id), patch, { merge: true });

      // Atualiza estado local + limpa draft
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setSaveStates((prev) => ({ ...prev, [id]: "saved" }));
      setTimeout(() => {
        setSaveStates((prev) => ({ ...prev, [id]: "idle" }));
      }, 2500);
    } catch (err) {
      setSaveStates((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  // Grava TODOS os produtos alterados em batches
  const saveAll = async () => {
    const dirtyIds = Object.keys(drafts).filter((id) =>
      products.some((p) => p.id === id)
    );
    if (dirtyIds.length === 0) {
      setBulkMessage("Não há alterações por guardar.");
      return;
    }

    setBulkSaving(true);
    setBulkMessage("");

    let success = 0;
    let errors = 0;
    const now = new Date().toISOString();

    try {
      const patches = dirtyIds.map((id) => {
        const original = products.find((p) => p.id === id);
        const draft = drafts[id];
        return {
          id,
          patch: {
            ...draft,
            price: Number(draft.price ?? original.price) || 0,
            stock: Number(draft.stock ?? original.stock) || 0,
            available: Boolean(
              draft.available !== undefined
                ? draft.available
                : original.available
            ),
            stock_enabled: Boolean(
              draft.stock_enabled !== undefined
                ? draft.stock_enabled
                : original.stock_enabled
            ),
            updated_date: now,
          },
        };
      });

      const BATCH_SIZE = 400;
      for (let i = 0; i < patches.length; i += BATCH_SIZE) {
        const slice = patches.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        slice.forEach(({ id, patch }) => {
          batch.set(doc(db, "products", id), patch, { merge: true });
        });
        await batch.commit();
        success += slice.length;
      }

      // Atualiza estado local + limpa drafts
      setProducts((prev) =>
        prev.map((p) => {
          const patched = patches.find((pp) => pp.id === p.id);
          return patched ? { ...p, ...patched.patch } : p;
        })
      );
      setDrafts({});
      setBulkMessage(`✅ ${success} produtos guardados com sucesso!`);
    } catch (err) {
      errors = dirtyIds.length - success;
      setBulkMessage(`Erro: ${success} guardados, ${errors} falharam.`);
    } finally {
      setBulkSaving(false);
      setTimeout(() => setBulkMessage(""), 5000);
    }
  };

  // === Render ===

  if (loading) {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">A carregar produtos...</p>
      </div>
    );
  }

  if (loadingError) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
        <p className="text-sm text-red-300 flex-1">{loadingError}</p>
        <button
          onClick={load}
          className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg bg-secondary transition-colors flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Repetir
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header com instruções + botão guardar tudo */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              Editor visual de produtos
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Edita qualquer campo sem mexer no código. Ideal para trocar URLs
              de imagens (ex.: colar URL de foto do Instagram do B'Live).
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={load}
              title="Recarregar"
              className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={saveAll}
              disabled={bulkSaving || dirtyCount === 0}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {bulkSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {bulkSaving
                ? "A guardar..."
                : `Guardar tudo${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
            </button>
          </div>
        </div>
        {bulkMessage && (
          <div
            className={`mt-3 text-xs px-3 py-2 rounded-lg ${
              bulkMessage.startsWith("✅")
                ? "bg-green-500/10 text-green-400 border border-green-500/30"
                : "bg-red-500/10 text-red-300 border border-red-500/30"
            }`}
          >
            {bulkMessage}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border/50 rounded-2xl p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por nome ou descrição..."
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="todos">Todas as categorias</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] || c}
            </option>
          ))}
        </select>
      </div>

      {/* Lista de produtos editáveis */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-card border border-border/50 rounded-2xl">
          <p className="text-sm">
            {products.length === 0
              ? "Sem produtos. Usa o botão \"Importar Catálogo\" acima."
              : "Nenhum produto corresponde aos filtros."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const draft = drafts[p.id] || {};
            const isRowDirty = isDirty(p.id);
            const saveState = saveStates[p.id] || "idle";
            const currentImage = draft.image_url !== undefined ? draft.image_url : p.image_url;

            return (
              <div
                key={p.id}
                className={`bg-card border rounded-2xl p-4 space-y-3 transition-colors ${
                  isRowDirty ? "border-primary/50" : "border-border/50"
                }`}
              >
                {/* Linha 1: imagem + nome + preço + categoria + estado */}
                <div className="flex items-start gap-3">
                  {/* Preview da imagem */}
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary flex-shrink-0 flex items-center justify-center">
                    {currentImage ? (
                      <img
                        src={currentImage}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "block";
                        }}
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
                    )}
                    <ImageIcon
                      className="w-6 h-6 text-muted-foreground/40 hidden"
                    />
                  </div>

                  {/* Inputs principais */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      type="text"
                      value={getFieldValue(p, "name")}
                      onChange={(e) =>
                        updateDraft(p.id, "name", e.target.value)
                      }
                      placeholder="Nome do produto"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <input
                      type="text"
                      value={getFieldValue(p, "description") || ""}
                      onChange={(e) =>
                        updateDraft(p.id, "description", e.target.value)
                      }
                      placeholder="Descrição (ingredientes, variantes...)"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  {/* Estado gravação */}
                  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                    {saveState === "saving" && (
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    )}
                    {saveState === "saved" && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                    {saveState === "error" && (
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                </div>

                {/* Linha 2: image_url (destaque — caso de uso principal) */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 mb-1">
                    <ImageIcon className="w-3 h-3" /> URL da imagem
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={getFieldValue(p, "image_url") || ""}
                      onChange={(e) =>
                        updateDraft(p.id, "image_url", e.target.value)
                      }
                      placeholder="https://..."
                      className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {getFieldValue(p, "image_url") && (
                      <a
                        href={getFieldValue(p, "image_url")}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir imagem"
                        className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors flex-shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Linha 3: preço, categoria, stock, disponibilidade + guardar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Preço (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={getFieldValue(p, "price")}
                      onChange={(e) =>
                        updateDraft(p.id, "price", e.target.value)
                      }
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Categoria
                    </label>
                    <select
                      value={getFieldValue(p, "category")}
                      onChange={(e) =>
                        updateDraft(p.id, "category", e.target.value)
                      }
                      className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {CATEGORY_LABELS[c] || c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Stock
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={getFieldValue(p, "stock") || 0}
                        onChange={(e) =>
                          updateDraft(p.id, "stock", e.target.value)
                        }
                        disabled={!getFieldValue(p, "stock_enabled")}
                        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-40"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">
                      Estado
                    </label>
                    <div className="flex items-center gap-2 h-[30px]">
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft(
                            p.id,
                            "available",
                            !getFieldValue(p, "available")
                          )
                        }
                        className={`text-xs font-medium px-2 py-1 rounded-lg transition-colors ${
                          getFieldValue(p, "available")
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {getFieldValue(p, "available") ? "Ativo" : "Inativo"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateDraft(
                            p.id,
                            "stock_enabled",
                            !getFieldValue(p, "stock_enabled")
                          )
                        }
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                          getFieldValue(p, "stock_enabled")
                            ? "bg-primary/15 text-primary"
                            : "bg-secondary text-muted-foreground"
                        }`}
                        title="Ativar/desativar controlo de stock"
                      >
                        stock
                      </button>
                    </div>
                  </div>
                </div>

                {/* Linha 4: botão guardar linha (só aparece se houver alterações) */}
                {isRowDirty && (
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => saveOne(p.id)}
                      disabled={saveState === "saving"}
                      className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {saveState === "saving" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Save className="w-3 h-3" />
                      )}
                      Guardar linha
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
