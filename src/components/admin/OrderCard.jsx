import { motion } from "framer-motion";
import {
  MessageSquare,
  CircleDot,
  CheckCircle2,
  Receipt,
} from "lucide-react";

// Configuração visual do indicador de tab_status (conta aberta vs fechada)
// Este é o destaque principal do cartão — aparece numa faixa no topo.
const tabStatusMeta = {
  open: {
    label: "Mesa Ativa · Aberta",
    className: "bg-green-500/15 text-green-300 border-green-500/30",
    icon: CircleDot,
    cardBorder: "border-l-green-500",
  },
  closed: {
    label: "Conta Paga · Fechada",
    className: "bg-secondary text-muted-foreground border-border",
    icon: CheckCircle2,
    cardBorder: "border-l-border/50",
  },
};

// Normaliza tab_status: pedidos sem o campo são tratados como "open"
function normalizeTabStatus(s) {
  if (!s) return "open";
  return s === "closed" ? "closed" : "open";
}

export default function OrderCard({ order }) {
  // Indicador de conta (tab_status)
  const tabStatus = normalizeTabStatus(order.tab_status);
  const tabMeta = tabStatusMeta[tabStatus];
  const TabIcon = tabMeta.icon;
  const isClosed = tabStatus === "closed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border/50 border-l-4 ${tabMeta.cardBorder} rounded-2xl overflow-hidden ${
        isClosed ? "opacity-70" : ""
      }`}
    >
      {/* === Faixa de destaque: tab_status === */}
      <div
        className={`flex items-center justify-between px-4 py-1.5 border-b border-border/40 ${tabMeta.className}`}
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          <TabIcon className="w-3 h-3" />
          {tabMeta.label}
        </span>
        <span className="flex items-center gap-1 text-[10px] opacity-70">
          <Receipt className="w-2.5 h-2.5" />
          {order.id?.slice(0, 6)}
        </span>
      </div>

      {/* === Cabeçalho: mesa + hora === */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <p className="font-playfair font-bold text-base">
            Mesa {order.table_number || order.table}
          </p>
          {/* Badge de merge */}
          {Number(order.merge_count) > 0 && (
            <span
              className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium"
              title={`Pedido atualizado ${order.merge_count}× com novos itens`}
            >
              +{order.merge_count}
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

      {/* === Itens === */}
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

      {/* === Notas === */}
      {order.notes && (
        <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300 font-medium">{order.notes}</p>
        </div>
      )}

      {/* === Rodapé: total === */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-t border-border/30">
        <p className="font-bold text-primary text-base">
          €{order.total_amount?.toFixed(2)}
        </p>
        {isClosed && (
          <span className="text-muted-foreground text-sm font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fechada
          </span>
        )}
      </div>
    </motion.div>
  );
}
