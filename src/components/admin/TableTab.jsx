// src/components/admin/TableTab.jsx
// -------------------------------------------------------------
// Cartão de Mesa (Open Tab) — otimizado para tablet touchscreen.
//
// Design Tablet-First:
//   - Cabeçalho de alto contraste (fundo sólido, texto branco)
//   - Touch targets grandes (min-h-[44px]) em todos os botões
//   - Botão "Cancelar" isolado dos botões de avançar estado
//   - Badges de estado vibrantes (laranja/azul/verde)
//   - shadow-md + rounded-2xl para parecer bloco físico
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
  XCircle,
} from "lucide-react";
import { closeTableOrders, updateOrder, deleteOrder } from "@/lib/db";
import { useAuth } from "@/lib/AuthContext";

const STATUS_FLOW = ["recebido", "pronto", "entregue"];

const STATUS_META = {
  recebido: {
    label: "Recebido",
    // Laranja vibrante — alerta máximo, precisa de ação
    badge: "bg-orange-500 text-white",
    badgeSm: "bg-orange-500/20 text-orange-400 border-orange-500/40",
    icon: Bell,
    nextLabel: "Pronto",
    nextIcon: ChefHat,
    // Botão de avanço: verde (sinal de "avançar")
    nextBtn: "bg-green-600 text-white hover:bg-green-700",
  },
  pronto: {
    label: "Pronto",
    // Azul vibrante — pronto para entrega
    badge: "bg-blue-500 text-white",
    badgeSm: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    icon: ChefHat,
    nextLabel: "Entregue",
    nextIcon: PackageCheck,
    nextBtn: "bg-blue-600 text-white hover:bg-blue-700",
  },
  entregue: {
    label: "Entregue",
    // Verde vibrante — concluído
    badge: "bg-green-600 text-white",
    badgeSm: "bg-green-600/20 text-green-400 border-green-600/40",
    icon: PackageCheck,
    nextLabel: null,
    nextIcon: null,
    nextBtn: "",
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

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const aT = a.created_date ? new Date(a.created_date).getTime() : 0;
      const bT = b.created_date ? new Date(b.created_date).getTime() : 0;
      return bT - aT;
    });
  }, [orders]);

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
      setError(`Erro ao atualizar pedido: ${err?.message || ""}`);
    } finally {
      setAdvancingIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleCancelOrder = async (e, order) => {
    e.stopPropagation();
    const confirm = window.confirm(
      `Anular este pedido?\n\n` +
        `${(order.items || []).length} item(s) · €${Number(order.total_amount).toFixed(2)}\n\n` +
        `O pedido será removido permanentemente.`
    );
    if (!confirm) return;

    try {
      await deleteOrder(order.id);
    } catch (err) {
      setError(`Erro ao anular pedido: ${err?.message || ""}`);
    }
  };

  const handleClearTable = async () => {
    const confirm = window.confirm(
      `Fechar a conta da Mesa ${tableNumber}?\n\n` +
        `${orders.length} pedido${orders.length !== 1 ? "s" : ""} · ` +
        `Total: €${totalAmount.toFixed(2)}\n\nConfirmar?`
    );
    if (!confirm) return;

    setClearing(true);
    setError("");
    try {
      await closeTableOrders(tableNumber, user);
    } catch (err) {
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
      className="bg-card rounded-2xl overflow-hidden shadow-md border border-border/60"
    >
      {/* === Cabeçalho — alto contraste, fundo sólido === */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer bg-primary text-primary-foreground"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary-foreground/15 flex items-center justify-center flex-shrink-0">
            <Wine className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="font-playfair font-bold text-xl leading-none">
              Mesa {tableNumber}
            </p>
            <p className="text-[10px] opacity-80 mt-1 flex items-center gap-2 flex-wrap">
              {earliestTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> {formatTime(earliestTime)}
                </span>
              )}
              {latestTime > 0 && latestTime !== earliestTime && (
                <span>→ {formatTime(latestTime)}</span>
              )}
              <span className="opacity-60">
                · {orders.length} pedido{orders.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Badges de contagem por estado — vibrantes */}
          <div className="flex items-center gap-1.5">
            {statusCounts.recebido > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg min-w-[24px] text-center">
                {statusCounts.recebido}
              </span>
            )}
            {statusCounts.pronto > 0 && (
              <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg min-w-[24px] text-center">
                {statusCounts.pronto}
              </span>
            )}
          </div>
          <div className="text-right">
            <p className="text-[10px] opacity-70 uppercase tracking-wider leading-none">
              Total
            </p>
            <p className="font-bold text-lg leading-none mt-0.5">
              €{totalAmount.toFixed(2)}
            </p>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 opacity-70" />
          ) : (
            <ChevronDown className="w-5 h-5 opacity-70" />
          )}
        </div>
      </div>

      {/* === Corpo — pedidos individuais === */}
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
                  className={`rounded-xl border-2 overflow-hidden ${
                    status === "entregue"
                      ? "border-green-600/20 opacity-60"
                      : status === "recebido"
                      ? "border-orange-500/30"
                      : "border-blue-500/30"
                  }`}
                >
                  {/* Cabeçalho do pedido — badge de estado vibrante + hora */}
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/40">
                    <span
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 min-h-[32px] ${meta.badge}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 flex-1 min-w-0">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTime(new Date(order.created_date).getTime())}
                      {Number(order.merge_count) > 0 && (
                        <span className="bg-primary/15 text-primary px-1.5 py-0.5 rounded-md font-medium ml-1">
                          +{order.merge_count}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Itens */}
                  <div className="px-3 py-2 space-y-1">
                    {(order.items || []).map((item, i) => {
                      const isMergedItem =
                        item.added_at &&
                        order.created_date &&
                        new Date(item.added_at).getTime() >
                          new Date(order.created_date).getTime();
                      const mergeQty = Number(item.last_merge_qty) || 0;

                      return (
                        <div
                          key={`${item.product_id || i}`}
                          className={`flex justify-between text-xs items-center ${
                            isMergedItem ? "bg-primary/5 -mx-1 px-1 rounded" : ""
                          }`}
                        >
                          <span className="text-foreground flex items-center gap-1.5 min-w-0">
                            <span className="bg-primary/20 text-primary font-bold px-1 py-0.5 rounded text-[10px] flex-shrink-0 min-w-[22px] text-center">
                              {item.quantity}×
                            </span>
                            {mergeQty > 0 && (
                              <span className="bg-green-500/20 text-green-400 font-bold px-1 py-0.5 rounded text-[9px] flex-shrink-0">
                                +{mergeQty}
                              </span>
                            )}
                            <span className="truncate">{item.product_name}</span>
                            {isMergedItem && (
                              <span className="bg-primary/20 text-primary font-bold px-1 py-0.5 rounded text-[8px] flex-shrink-0 uppercase tracking-wider">
                                novo
                              </span>
                            )}
                          </span>
                          <span className="text-muted-foreground font-medium flex-shrink-0 ml-2">
                            €{Number(item.total).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    {order.notes && (
                      <div className="mt-1 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-2 py-1.5 flex items-start gap-1.5">
                        <MessageSquare className="w-2.5 h-2.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[10px] text-yellow-300 font-medium">
                          {order.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* === Barra de ações — touch targets grandes === */}
                  {/* Botão Cancelar ISOLADO à direita, separado dos botões de avançar */}
                  {meta.nextLabel && (
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/30 border-t border-border/30">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAdvanceStatus(order);
                        }}
                        disabled={isAdvancing}
                        className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-3 rounded-xl min-h-[44px] active:scale-95 transition-all disabled:opacity-50 ${meta.nextBtn}`}
                      >
                        {isAdvancing ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <NextIcon className="w-4 h-4" />
                        )}
                        {meta.nextLabel}
                      </button>
                      {/* Botão Cancelar — isolado com margem e cor distinta */}
                      <button
                        onClick={(e) => handleCancelOrder(e, order)}
                        title="Anular pedido"
                        className="flex-shrink-0 w-11 h-11 min-h-[44px] rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center hover:bg-red-500/20 active:scale-95 transition-all"
                      >
                        <XCircle className="w-5 h-5 text-red-400" />
                      </button>
                    </div>
                  )}
                  {!meta.nextLabel && (
                    <div className="flex items-center justify-center px-3 py-2.5 bg-green-600/10 border-t border-green-600/20">
                      <span className="text-green-400 text-sm font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Entregue
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Botão Adicionar Pedido — touch target grande */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onAddOrder) onAddOrder(tableNumber);
            }}
            className="w-full flex items-center justify-center gap-2 bg-primary/10 text-primary border-2 border-dashed border-primary/40 text-sm font-bold py-3 rounded-xl min-h-[44px] hover:bg-primary/15 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Adicionar Pedido
          </button>

          {error && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* === Rodapé — Total + Limpar Mesa === */}
      <div className="flex items-center justify-between px-4 py-3 bg-red-500/5 border-t-2 border-red-500/20">
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
          className="flex items-center gap-2 bg-red-600 text-white text-sm font-bold px-5 py-3 rounded-xl min-h-[44px] hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 shadow-md shadow-red-600/30"
        >
          <Trash2 className="w-4 h-4" />
          {clearing ? "A fechar..." : "Limpar Mesa"}
        </button>
      </div>
    </motion.div>
  );
}
