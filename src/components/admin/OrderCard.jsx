import { motion } from "framer-motion";
import {
  MessageSquare,
  CircleDot,
  CheckCircle2,
  Receipt,
  XCircle,
} from "lucide-react";
import { cancelOrderItem } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";

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

function normalizeTabStatus(s) {
  if (!s) return "open";
  return s === "closed" ? "closed" : "open";
}

function normalizeStatus(s) {
  if (!s) return "recebido";
  if (["pendente", "confirmado", "em_preparacao"].includes(s)) return "recebido";
  if (s === "pago") return "entregue";
  return s;
}

export default function OrderCard({ order }) {
  const { user } = useAuth();
  const tabStatus = normalizeTabStatus(order.tab_status);
  const tabMeta = tabStatusMeta[tabStatus];
  const TabIcon = tabMeta.icon;
  const isClosed = tabStatus === "closed";
  const isOpen = !isClosed;
  const isEntregue = normalizeStatus(order.status) === "entregue";
  const canCancel = isOpen && !isEntregue;

  const handleCancelItem = async (e, itemIndex, item) => {
    e.stopPropagation();
    const currentStatus = normalizeStatus(order.status);
    if (currentStatus === "entregue") {
      window.alert("Não é possível anular itens de um pedido já entregue.");
      return;
    }
    const confirm = window.confirm(
      `Anular este item?\n\n` +
        `${item.quantity}× ${item.product_name} · €${Number(item.total).toFixed(2)}\n\n` +
        `O valor será subtraído do total.\n` +
        `A anulação fica registada para auditoria.`
    );
    if (!confirm) return;
    try {
      await cancelOrderItem(order.id, itemIndex, user);
    } catch (err) {
      alert(`Erro: ${err?.message || ""}`);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border/50 border-l-4 ${tabMeta.cardBorder} rounded-2xl overflow-hidden ${
        isClosed ? "opacity-70" : ""
      }`}
    >
      {/* Faixa tab_status */}
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

      {/* Cabeçalho: mesa + hora */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <p className="font-playfair font-bold text-base">
            Mesa {order.table_number || order.table}
          </p>
          {Number(order.merge_count) > 0 && (
            <span
              className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium"
              title={`Pedido atualizado ${order.merge_count}×`}
            >
              +{order.merge_count}
            </span>
          )}
          {/* Badge de origem: POS (staff) vs Menu (cliente) */}
          {order.source === "pos" && order.created_by_email && (
            <span
              className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md font-medium truncate max-w-[120px]"
              title={`Pedido criado por ${order.created_by_email}`}
            >
              POS: {order.created_by_email}
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

      {/* Itens — com botão X para anulação individual (só se aberto) */}
      <div className="px-4 py-3 space-y-1.5">
        {order.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm items-center">
            <span className="text-foreground flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-primary font-semibold">{item.quantity}×</span>
              <span className="truncate">{item.product_name}</span>
            </span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-muted-foreground font-medium">
                €{item.total?.toFixed(2)}
              </span>
              {canCancel && (
                <button
                  onClick={(e) => handleCancelItem(e, i, item)}
                  title={`Anular ${item.product_name}`}
                  className="w-6 h-6 rounded-md bg-red-500/10 flex items-center justify-center hover:bg-red-500/25 active:scale-90 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                </button>
              )}
            </div>
          </div>
        ))}
        {/* Itens cancelados (auditoria visível) */}
        {order.canceled_items?.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
              Itens anulados ({order.canceled_items.length})
            </p>
            {order.canceled_items.map((ci, i) => (
              <div key={i} className="flex justify-between text-xs items-center opacity-50 line-through">
                <span className="text-muted-foreground">
                  {ci.quantity}× {ci.product_name}
                </span>
                <span className="text-muted-foreground">
                  €{Number(ci.total).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notas */}
      {order.notes && (
        <div className="mx-4 mb-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300 font-medium">{order.notes}</p>
        </div>
      )}

      {/* Rodapé: total */}
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
