// src/components/admin/TableTab.jsx
// -------------------------------------------------------------
// Cartão de Mesa (Open Tab) para o ecrã /staff.
//
// Modelo Open Tabs com linha de montagem:
//   - Mesa aberta (tab_status="open"): mostra pedidos individuais,
//     cada um com estado recebido → pronto → entregue.
//   - Botões para o staff avançar o estado de cada pedido.
//   - Botão "+ Adicionar Pedido" para o staff adicionar produtos
//     manualmente (POS mode).
//   - Botão "Limpar Mesa" para fechar a conta (Caixa).
// -------------------------------------------------------------

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  MessageSquare,
  Clock,
  Wine,
  Plus,
  ChefHat,
  PackageCheck,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { closeTableOrders, updateOrder } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";

// Fluxo de estados: recebido → pronto → entregue
const STATUS_FLOW = ["recebido", "pronto", "entregue"];

const STATUS_META = {
  recebido: {
    label: "Recebido",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    icon: Bell,
    nextLabel: "Marcar Pronto",
    nextIcon: ChefHat,
  },
  pronto: {
    label: "Pronto",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    icon: ChefHat,
    nextLabel: "Marcar Entregue",
    nextIcon: PackageCheck,
  },
  entregue: {
    label: "Entregue",
    color: "bg-green-500/20 text-green-400 border-green-500/30",
    icon: PackageCheck,
    nextLabel: null,
    nextIcon: null,
  },
};

function normalizeStatus(s) {
  if (!s) return "recebido";
  if (["pendente", "confirmado", "em_preparacao"].includes(s)) return "recebido";
  if (s === "pago") return "entregue";
  return STATUS_FLOW.includes(s) ? s : "recebido";
}

export default function TableTab({ tableNumber, orders, onAddOrder }) {
  const [expanded, setExpanded] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [advancingIds, setAdvancingIds] = useState(new Set());
  const { user } = useAuth();

  const totalAmount = orders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // Pedidos ordenados por data (mais recente primeiro)
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bT - aT;
    });
  }, [orders]);

  // Contagem por estado
  const statusCounts = useMemo(() => {
    const counts = { recebido: 0, pronto: 0, entregue: 0 };
    for (const o of orders) {
      const s = normalizeStatus(o.status);
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [orders]);

  const latestTime = orders.reduce((latest, o) => {
    if (!o.created_date) return latest;
    const t = new Date(o.created_date).getTime();
    return t > latest ? t : latest;
  }, 0);

  const earliestTime = orders.reduce((earliest, o) => {
    if (!o.created_date) return earliest;
    const t = new Date(o.created_date).getTime();
    return earliest === 0 || t < earliest ? t : earliest;
  }, 0);

  const formatTime = (ts) => {
    if (!ts) return "";
    return new Date(ts).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleAdvanceStatus = async (order) => {
    const currentStatus = normalizeStatus(order.status);
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex < 0 || currentIndex >= STATUS_FLOW.length - 1) return;

    const nextStatus = STATUS_FLOW[currentIndex + 1];
    setAdvancingIds((prev) => new Set([...prev, order.id]));

    try {
      await updateOrder(order.id, { status: nextStatus });
    } catch (err) {
      console.error(`[TableTab] Erro ao avançar pedido ${order.id}:`, err);
      setError(`Erro ao atualizar pedido: ${err?.message || ""}`);
    } finally {
      setAdvancingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleClearTable = async () => {
    const confirm = window.confirm(
      `Fechar a conta da Mesa ${tableNumber}?\n\n` +
        `${orders.length} pedido${orders.length !== 1 ? "s" : ""} ` +
        `ser${orders.length !== 1 ? "ão" : "á"} marcado${orders.length !== 1 ? "s" : ""} ` +
        `como "closed" e a mesa desaparece deste ecrã.\n\n` +
        `Total: €${totalAmount.toFixed(2)}\n\nConfirmar?`
    );
    if (!confirm) return;

    setClearing(true);
    setError("");
    try {
      await closeTableOrders(tableNumber, user);
    } catch (err) {
      console.error(`[TableTab] Erro ao fechar mesa ${tableNumber}:`, err);
      setError(`Erro ao fechar mesa: ${err?.message || ""}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-primary/30 border-l-4 border-l-green-500 rounded-2xl overflow-hidden shadow-lg shadow-primary/5"
    >
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border/40 cursor-pointer bg-primary/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Wine className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-playfair font-bold text-lg leading-none">
              Mesa {tableNumber}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              {earliestTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {formatTime(earliestTime)}
                </span>
              )}
              {latestTime > 0 && latestTime !== earliestTime && (
                <span>→ {formatTime(latestTime)}</span>
              )}
              <span className="opacity-50">
                · {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              </span>
              {statusCounts.recebido > 0 && (
                <span className="bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded-md font-medium">
                  {statusCounts.recebido} recebido{statusCounts.recebido !== 1 ? "s" : ""}
                </span>
              )}
              {statusCounts.pronto > 0 && (
                <span className="bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md font-medium">
                  {statusCounts.pronto} pronto{statusCounts.pronto !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">
              Total
            </p>
            <p className="font-bold text-primary text-lg leading-none mt-0.5">
              €{totalAmount.toFixed(2)}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Corpo — pedidos individuais com estado */}
      {expanded && (
        <div className="px-4 py-3 space-y-3">
          {sortedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sem pedidos.</p>
          ) : (
            sortedOrders.map((order) => {
              const status = normalizeStatus(order.status);
              const meta = STATUS_META[status];
              const StatusIcon = meta.icon;
              const NextIcon = meta.nextIcon;
              const isAdvancing = advancingIds.has(order.id);

              return (
                <div
                  key={order.id}
                  className={`rounded-xl border border-border/40 overflow-hidden ${
                    status === "entregue" ? "opacity-60" : ""
                  }`}
                >
                  {/* Cabeçalho do pedido: hora + estado + botão avançar */}
                  <div className="flex items-center justify-between px-3 py-2 bg-secondary/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(new Date(order.created_date).getTime())}
                      </span>
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${meta.color}`}
                      >
                        <StatusIcon className="w-2.5 h-2.5" />
                        {meta.label}
                      </span>
                      {Number(order.merge_count) > 0 && (
                        <span
                          className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium"
                          title={`Pedido atualizado ${order.merge_count}×`}
                        >
                          +{order.merge_count}
                        </span>
                      )}
                    </div>
                    {meta.nextLabel && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdvanceStatus(order);
                        }}
                        disabled={isAdvancing}
                        className="flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-lg hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                      >
                        {isAdvancing ? (
                          <span className="w-3 h-3 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        ) : (
                          <NextIcon className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">{meta.nextLabel}</span>
                        <span className="sm:hidden">{meta.label === "recebido" ? "Pronto" : "Entregue"}</span>
                      </button>
                    )}
                  </div>

                  {/* Itens */}
                  <div className="px-3 py-2 space-y-1">
                    {(order.items || []).map((item, i) => (
                      <div
                        key={`${item.product_id || i}`}
                        className="flex justify-between text-xs items-center"
                      >
                        <span className="text-foreground flex items-center gap-1.5 min-w-0">
                          <span className="bg-primary/20 text-primary font-bold px-1 py-0.5 rounded text-[10px] flex-shrink-0 min-w-[22px] text-center">
                            {item.quantity}×
                          </span>
                          <span className="truncate">{item.product_name}</span>
                        </span>
                        <span className="text-muted-foreground font-medium flex-shrink-0 ml-2">
                          €{Number(item.total).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {order.notes && (
                      <div className="mt-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                        <MessageSquare className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-yellow-300 font-medium">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Botão Adicionar Pedido (POS mode) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onAddOrder) onAddOrder(tableNumber);
            }}
            className="w-full flex items-center justify-center gap-1.5 bg-primary/10 text-primary border border-dashed border-primary/40 text-xs font-semibold py-2.5 rounded-xl hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Pedido
          </button>

          {error && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Rodapé — Total + Limpar Mesa */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-500/5 border-t border-red-500/20">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Total a pagar
          </p>
          <p className="font-bold text-foreground text-xl leading-none mt-0.5">
            €{totalAmount.toFixed(2)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClearTable();
          }}
          disabled={clearing}
          className="flex items-center gap-1.5 bg-red-500 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50 shadow-lg shadow-red-500/20"
        >
          <Trash2 className="w-4 h-4" />
          {clearing ? "A fechar..." : "Limpar Mesa"}
        </button>
      </div>
    </motion.div>
  );
}
