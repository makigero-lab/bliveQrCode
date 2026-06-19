import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { ChevronRight, MessageSquare } from "lucide-react";

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

export default function OrderCard({ order, onUpdate }) {
  const handleAdvance = async () => {
    const next = nextStatus[order.status];
    if (!next) return;

    if (order.status === "pendente" && next === "confirmado") {
      const products = await base44.entities.Product.list();
      for (const item of (order.items || [])) {
        const product = products.find((p) => p.id === item.product_id);
        if (product && product.stock_enabled && product.stock > 0) {
          const newStock = Math.max(0, product.stock - item.quantity);
          const updates = { stock: newStock };
          if (newStock === 0) updates.available = false;
          await base44.entities.Product.update(product.id, updates);
        }
      }
    }

    await base44.entities.Order.update(order.id, { status: next });
    onUpdate();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <p className="font-playfair font-bold text-base">Mesa {order.table_number}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusColors[order.status]}`}>
            {statusLabel[order.status]}
          </span>
        </div>
        <p className="text-muted-foreground text-xs">
          {new Date(order.created_date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="px-4 py-3 space-y-1.5">
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
        <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300 font-medium">{order.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-t border-border/30">
        <p className="font-bold text-primary text-base">€{order.total_amount?.toFixed(2)}</p>
        {nextStatus[order.status] ? (
          <button
            onClick={handleAdvance}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 active:scale-95 transition-all"
          >
            {nextLabel[order.status]}
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-green-400 text-sm font-semibold">✓ Pronto</span>
        )}
      </div>
    </motion.div>
  );
}