import { motion } from "framer-motion";
import { ChevronRight, MessageSquare } from "lucide-react";
import { listProducts, updateOrder, updateProduct } from "@/lib/db";

// Novo fluxo: recebido → pronto → entregue
// Compatibilidade: estados legacy são mapeados para o novo fluxo.
const statusColors = {
  recebido: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  pronto: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  entregue: "bg-green-500/20 text-green-400 border-green-500/30",
  // Legacy
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmado: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  em_preparacao: "bg-orange-500/20 text-orange-400 border-orange-500/30",
};

const statusLabel = {
  recebido: "Recebido",
  pronto: "Pronto",
  entregue: "Entregue",
  // Legacy
  pendente: "Recebido",
  confirmado: "Recebido",
  em_preparacao: "Recebido",
};

const nextStatus = {
  recebido: "pronto",
  pronto: "entregue",
  // Legacy → novo fluxo
  pendente: "pronto",
  confirmado: "pronto",
  em_preparacao: "pronto",
};

const nextLabel = {
  recebido: "Marcar Pronto",
  pronto: "Marcar Entregue",
  pendente: "Marcar Pronto",
  confirmado: "Marcar Pronto",
  em_preparacao: "Marcar Pronto",
};

// Normaliza status legacy para o novo fluxo (para display)
function normalizeStatus(s) {
  if (!s) return "recebido";
  if (["pendente", "confirmado", "em_preparacao"].includes(s)) return "recebido";
  if (s === "pago") return "entregue";
  return s;
}

export default function OrderCard({ order, onUpdate }) {
  const handleAdvance = async () => {
    const currentNormalized = normalizeStatus(order.status);
    const next = nextStatus[currentNormalized];
    if (!next) return;

    try {
      // Quando passa de "recebido" → "pronto", decrementa stock
      if (currentNormalized === "recebido" && next === "pronto") {
        const products = await listProducts();
        for (const item of order.items || []) {
          const product = products.find((p) => p.id === item.product_id);
          if (product && product.stock_enabled && product.stock > 0) {
            const newStock = Math.max(0, product.stock - item.quantity);
            const updates = { stock: newStock };
            if (newStock === 0) updates.available = false;
            await updateProduct(product.id, updates);
          }
        }
      }

      await updateOrder(order.id, { status: next });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("[OrderCard] Erro ao avançar pedido:", err);
    }
  };

  const displayStatus = normalizeStatus(order.status);
  const canAdvance = Boolean(nextStatus[displayStatus]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border/50 rounded-2xl overflow-hidden ${
        displayStatus === "entregue" ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <p className="font-playfair font-bold text-base">
            Mesa {order.table_number || order.table}
          </p>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              statusColors[displayStatus]
            }`}
          >
            {statusLabel[displayStatus]}
          </span>
          {/* Badge de merge */}
          {Number(order.merge_count) > 0 && (
            <span
              className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium"
              title={`Pedido atualizado ${order.merge_count}× com novos itens`}
            >
              +{order.merge_count}
            </span>
          )}
          {/* Badge tab_status (para o Admin distinguir open/closed) */}
          {order.tab_status && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                order.tab_status === "closed"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-green-500/15 text-green-400"
              }`}
            >
              {order.tab_status === "closed" ? "fechada" : "aberta"}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {order.created_date
            ? new Date(order.created_date).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </p>
      </div>

      <div className="px-4 py-3 space-y-1.5">
        {order.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-foreground">
              <span className="text-primary font-semibold">{item.quantity}×</span>{" "}
              {item.product_name}
            </span>
            <span className="text-muted-foreground font-medium">
              €{item.total?.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300 font-medium">{order.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-t border-border/30">
        <p className="font-bold text-primary text-base">
          €{order.total_amount?.toFixed(2)}
        </p>
        {canAdvance ? (
          <button
            onClick={handleAdvance}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
          >
            {nextLabel[displayStatus]}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-green-400 text-sm font-semibold">✓ Entregue</span>
        )}
      </div>
    </motion.div>
  );
}
