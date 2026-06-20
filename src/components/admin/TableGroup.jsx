import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Trash2, MessageSquare, ChevronRight } from "lucide-react";
import { listProducts, updateOrder, updateProduct, deleteOrder } from "@/lib/db";

const statusColors = {
  pendente: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  confirmado: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  em_preparacao: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  pronto: "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusLabel = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_preparacao: "Em prep.",
  pronto: "Pronto",
};

const nextStatus = {
  pendente: "confirmado",
  confirmado: "em_preparacao",
  em_preparacao: "pronto",
};

const nextLabel = {
  pendente: "Confirmar",
  confirmado: "Preparar",
  em_preparacao: "Pronto",
};

// Returns the "worst" (most urgent) status among orders
function worstStatus(orders) {
  const priority = ["pendente", "em_preparacao", "confirmado", "pronto"];
  for (const s of priority) {
    if (orders.some((o) => o.status === s)) return s;
  }
  return orders[0]?.status;
}

export default function TableGroup({ tableNumber, orders, onUpdate, onClearTable }) {
  const [expanded, setExpanded] = useState(true);
  const [clearing, setClearing] = useState(false);

  const totalAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const mainStatus = worstStatus(orders);

  // Consolidate all items across orders for the summary view
  const allItems = orders.flatMap((o) =>
    (o.items || []).map((item) => ({ ...item, orderId: o.id, orderStatus: o.status }))
  );

  const handleAdvance = async (order) => {
    const next = nextStatus[order.status];
    if (!next) return;

    try {
      if (order.status === "pendente" && next === "confirmado") {
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
    }
  };

  const handleClearTable = async () => {
    setClearing(true);
    try {
      for (const order of orders) {
        await deleteOrder(order.id);
      }
    } catch (err) {
    } finally {
      setClearing(false);
      if (onClearTable) onClearTable();
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden"
    >
      {/* Table header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/40 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="font-playfair font-bold text-lg">Mesa {tableNumber}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[mainStatus]}`}>
            {statusLabel[mainStatus]}
          </span>
          <span className="text-xs text-muted-foreground">({orders.length} pedido{orders.length !== 1 ? "s" : ""})</span>
        </div>
        <div className="flex items-center gap-3">
          <p className="font-bold text-primary text-base">€{totalAmount.toFixed(2)}</p>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Individual orders */}
            {orders.map((order, idx) => (
              <div key={order.id} className={idx > 0 ? "border-t border-border/30" : ""}>
                <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {order.created_date
                        ? new Date(order.created_date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[order.status]}`}>
                      {statusLabel[order.status]}
                    </span>
                  </div>
                  {nextStatus[order.status] && (
                    <button
                      onClick={() => handleAdvance(order)}
                      className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
                    >
                      {nextLabel[order.status]}
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}
                  {order.status === "pronto" && (
                    <span className="text-xs text-green-400 font-semibold">✓ Pronto</span>
                  )}
                </div>

                <div className="px-4 py-2 space-y-1">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-foreground">
                        <span className="text-primary font-semibold">{item.quantity}×</span>{" "}
                        {item.product_name}
                      </span>
                      <span className="text-muted-foreground font-medium">€{item.total?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="mx-4 mb-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-300 font-medium">{order.notes}</p>
                  </div>
                )}
              </div>
            ))}

            {/* Footer: total + clear table */}
            <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-t border-border/30">
              <div>
                <p className="text-xs text-muted-foreground">Total da mesa</p>
                <p className="font-bold text-primary text-xl">€{totalAmount.toFixed(2)}</p>
              </div>
              <button
                onClick={handleClearTable}
                disabled={clearing}
                className="flex items-center gap-1.5 bg-destructive/10 text-destructive border border-destructive/30 text-sm font-semibold px-4 py-2 rounded-xl hover:bg-destructive/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {clearing ? "A limpar..." : "Limpar mesa"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
