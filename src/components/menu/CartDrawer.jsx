import { motion } from "framer-motion";
import { X, Trash2, ShoppingBag, Send, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { createOrder } from "@/lib/db";

export default function CartDrawer({ cart, products, onClose, onRemove, onAdd, tableNumber, onOrderPlaced }) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const items = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => {
      const p = products.find((p) => p.id === id);
      return p ? { ...p, quantity: qty, total: p.price * qty } : null;
    })
    .filter(Boolean);

  const total = items.reduce((s, i) => s + i.total, 0);

  const handleSendOrder = async () => {
    if (items.length === 0) {
      setError("O carrinho está vazio.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Payload normalizado — createOrder valida e completa campos
      // em falta (table, items[], total_amount, status, tab_status).
      // Sem pagamentos: a app não processa pagamentos online; os
      // pedidos são pagos diretamente na mesa ao staff.
      // `table` é o novo campo principal (String); `table_number` é
      // mantido por retrocompatibilidade (escrito por createOrder).
      // `tab_status: "open"` abre a conta da mesa no /staff.
      const payload = {
        table: String(tableNumber || "1"),
        table_number: String(tableNumber || "1"), // legacy
        items: items.map((i) => ({
          product_id: i.id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.price,
          total: i.total,
        })),
        total_amount: total,
        status: "pendente",
        tab_status: "open",
        notes: notes || null,
      };

      console.info("[CartDrawer] A enviar pedido para Firestore:", {
        mesa: payload.table,
        items: payload.items.length,
        total: payload.total_amount,
        tab_status: payload.tab_status,
      });

      const created = await createOrder(payload);

      console.info("[CartDrawer] Pedido criado com id:", created.id);

      // Só avança para o ecrã de "Obrigado" se o pedido foi realmente
      // gravado no Firestore. Antes, chamava onOrderPlaced() no finally
      // mesmo em caso de erro — isso escondia falhas do utilizador.
      onOrderPlaced();
    } catch (err) {
      console.error("[CartDrawer] Erro ao enviar pedido:", err);
      setError(
        `Não foi possível enviar o pedido. ${err?.message || ""}.\n` +
          "Verifica a ligação à internet e tenta novamente."
      );
    } finally {
      setLoading(false);
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
        className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] flex flex-col border-t border-border"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <h2 className="font-playfair font-semibold text-lg">O teu pedido</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-muted-foreground text-xs">€{item.price.toFixed(2)} × {item.quantity}</p>
              </div>
              <span className="font-semibold text-primary">€{item.total.toFixed(2)}</span>
              <button
                onClick={() => onRemove(item.id, true)}
                className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </div>
          ))}

          <div className="pt-2">
            <label className="text-xs text-muted-foreground mb-1.5 block">Observações (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem gelo, alergia a frutos secos..."
              className="w-full bg-secondary border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {/* Erro de envio — visível ao utilizador */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 whitespace-pre-line">{error}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border/50 space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total</span>
            <span className="font-playfair font-bold text-2xl text-primary">€{total.toFixed(2)}</span>
          </div>
          <button
            onClick={handleSendOrder}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? "A enviar..." : "Enviar pedido"}
          </button>
        </div>
      </motion.div>
    </>
  );
}
