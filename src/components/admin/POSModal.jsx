// src/components/admin/POSModal.jsx
// -------------------------------------------------------------
// Modal POS para o staff adicionar produtos a uma mesa.
//
// Usado pelo /staff quando o staff clica "+ Adicionar Pedido"
// dentro de um cartão de mesa, ou "+ Nova Mesa" no topo.
//
// Mostra a lista de produtos disponíveis do Firestore, permite
// selecionar quantidades, e submete o pedido via createOrder.
// -------------------------------------------------------------

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Minus,
  Send,
  Search,
  Loader2,
  ShoppingBag,
  AlertTriangle,
} from "lucide-react";
import { listAvailableProducts, createOrder } from "@/lib/db";

const CATEGORIES = [
  { id: "todos", label: "Todos", emoji: "✨" },
  { id: "cocktails", label: "Cocktails", emoji: "🍹" },
  { id: "bebidas", label: "Bebidas", emoji: "🍺" },
  { id: "comida", label: "Comida", emoji: "🍔" },
  { id: "sobremesas", label: "Sobremesas", emoji: "🍮" },
  { id: "shisha", label: "Shisha", emoji: "💨" },
];

export default function POSModal({ tableNumber, onClose, onSubmitted }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState({});
  const [category, setCategory] = useState("todos");
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listAvailableProducts()
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError("Não foi possível carregar os produtos.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== "todos" && p.category !== category) return false;
      if (s && !p.name.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [products, category, search]);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((p) => p.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const addToCart = (id) =>
    setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id) =>
    setCart((c) => {
      const qty = c[id] || 0;
      if (qty <= 1) {
        const n = { ...c };
        delete n[id];
        return n;
      }
      return { ...c, [id]: qty - 1 };
    });

  const handleSubmit = async () => {
    if (cartCount === 0) return;

    setSubmitting(true);
    setError("");
    try {
      const items = Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => {
          const p = products.find((p) => p.id === id);
          return p
            ? {
                product_id: p.id,
                product_name: p.name,
                quantity: qty,
                unit_price: p.price,
                total: p.price * qty,
              }
            : null;
        })
        .filter(Boolean);

      await createOrder({
        table: String(tableNumber),
        table_number: String(tableNumber),
        items,
        total_amount: cartTotal,
        tab_status: "open",
        status: "recebido",
        notes: null,
      });


      if (onSubmitted) onSubmitted();
      onClose();
    } catch (err) {
      setError(`Erro ao submeter: ${err?.message || ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[90vh] flex flex-col border-t border-border"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <div>
              <h2 className="font-playfair font-semibold text-lg">
                Adicionar Pedido
              </h2>
              <p className="text-xs text-muted-foreground">
                Mesa {tableNumber} · POS Staff
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar produto..."
              className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground mt-2">A carregar produtos...</p>
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              Nenhum produto encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-4">
              {filtered.map((p) => {
                const qty = cart[p.id] || 0;
                return (
                  <div
                    key={p.id}
                    className="bg-secondary/50 border border-border/40 rounded-xl overflow-hidden flex flex-col"
                  >
                    {p.image_url && (
                      <div className="h-20 overflow-hidden">
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-2.5 flex-1 flex flex-col gap-1.5">
                      <p className="text-xs font-medium leading-tight line-clamp-2">
                        {p.name}
                      </p>
                      <p className="text-primary font-bold text-sm">
                        €{Number(p.price).toFixed(2)}
                      </p>
                      {qty > 0 ? (
                        <div className="flex items-center justify-between gap-1 mt-auto">
                          <button
                            onClick={() => removeFromCart(p.id)}
                            className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80"
                          >
                            <Minus className="w-3 h-3 text-muted-foreground" />
                          </button>
                          <span className="font-bold text-sm text-primary">
                            {qty}
                          </span>
                          <button
                            onClick={() => addToCart(p.id)}
                            className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center hover:bg-primary/80"
                          >
                            <Plus className="w-3 h-3 text-primary-foreground" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p.id)}
                          className="mt-auto w-full bg-primary/15 text-primary text-xs font-semibold py-1.5 rounded-lg hover:bg-primary/25 transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — total + submit */}
        {cartCount > 0 && (
          <div className="p-4 border-t border-border/50 bg-secondary/30 space-y-3">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {cartCount} item{cartCount !== 1 ? "s" : ""}
                </p>
                <p className="font-bold text-primary text-xl">
                  €{cartTotal.toFixed(2)}
                </p>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "A enviar..." : "Submeter Pedido"}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </>
  );
}
