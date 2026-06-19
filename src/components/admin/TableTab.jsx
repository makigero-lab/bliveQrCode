// src/components/admin/TableTab.jsx
// -------------------------------------------------------------
// Cartão de Mesa (Open Tab) para o ecrã /staff.
//
// Mostra uma mesa aberta (todos os pedidos com tab_status=="open"
// dessa mesa) numa única card consolidada:
//   - Número da mesa no topo
//   - Lista consolidada de itens (junta pedidos antigos e novos,
//     somando quantidades do mesmo produto)
//   - Valor total a pagar
//   - Botão "Limpar Mesa" que faz batch update (tab_status → closed)
//
// Diferente do TableGroup.jsx (legacy, usado no Admin.jsx):
//   - Não permite avançar estado de pedidos individuais (no /staff
//     interessa a conta global, não o estado de cada pedido).
//   - "Limpar Mesa" não apaga — faz closeTableOrders (batch update
//     tab_status="closed") para preservar o histórico.
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
} from "lucide-react";
import { closeTableOrders } from "@/lib/db";

export default function TableTab({ tableNumber, orders }) {
  const [expanded, setExpanded] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");

  // Total a pagar — soma de todos os pedidos
  const totalAmount = orders.reduce(
    (sum, o) => sum + (Number(o.total_amount) || 0),
    0
  );

  // Lista consolidada de itens — junta pedidos antigos + novos da mesma
  // mesa, somando as quantidades do mesmo produto (por product_id).
  const consolidatedItems = useMemo(() => {
    const map = new Map();
    for (const order of orders) {
      for (const item of order.items || []) {
        const key = item.product_id || item.product_name;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += Number(item.quantity) || 0;
          existing.total += Number(item.total) || 0;
          existing.orderCount += 1;
        } else {
          map.set(key, {
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unit_price) || 0,
            total: Number(item.total) || 0,
            orderCount: 1,
          });
        }
      }
    }
    // Ordena por ordem decrescente de quantidade
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity);
  }, [orders]);

  // Notas consolidadas (todas as notas de todos os pedidos)
  const allNotes = orders
    .filter((o) => o.notes)
    .map((o) => ({
      note: o.notes,
      time: o.created_date,
    }));

  // Horário do pedido mais recente (para mostrar "último pedido às HH:MM")
  const latestTime = orders.reduce((latest, o) => {
    if (!o.created_date) return latest;
    const t = new Date(o.created_date).getTime();
    return t > latest ? t : latest;
  }, 0);

  // Hora do primeiro pedido (para mostrar "aberta desde HH:MM")
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

  const handleClearTable = async () => {
    const confirm = window.confirm(
      `Fechar a conta da Mesa ${tableNumber}?\n\n` +
        `${orders.length} pedido${orders.length !== 1 ? "s" : ""} ` +
        `ser${orders.length !== 1 ? "ão" : "á"} marcado${orders.length !== 1 ? "s" : ""} ` +
        `como "closed" e a mesa desaparece deste ecrã.\n\n` +
        `Os pedidos continuam acessíveis no separador "Histórico".\n\n` +
        `Total: €${totalAmount.toFixed(2)}\n\n` +
        `Confirmar?`
    );
    if (!confirm) return;

    setClearing(true);
    setError("");
    try {
      console.info(
        `[TableTab] A fechar mesa ${tableNumber} (${orders.length} pedidos, total €${totalAmount.toFixed(2)})...`
      );
      const result = await closeTableOrders(tableNumber);
      console.info(
        `[TableTab] Mesa ${tableNumber} fechada: ${result.closed} pedidos atualizados.`
      );
      // O onSnapshot em Staff.jsx deteta a mudança de tab_status
      // automaticamente e remove a mesa do ecrã. Não é preciso
      // fazer nada aqui.
    } catch (err) {
      console.error(`[TableTab] Erro ao fechar mesa ${tableNumber}:`, err);
      setError(
        `Erro ao fechar mesa: ${err?.message || "verifica a consola."}`
      );
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
      className="bg-card border border-primary/30 rounded-2xl overflow-hidden shadow-lg shadow-primary/5"
    >
      {/* Cabeçalho — número da mesa + total + botão expandir */}
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
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
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

      {/* Corpo — lista consolidada de itens */}
      {expanded && (
        <div className="px-4 py-3 space-y-1.5">
          {consolidatedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Sem itens.</p>
          ) : (
            consolidatedItems.map((item, i) => (
              <div
                key={`${item.product_id || i}`}
                className="flex justify-between text-sm items-center"
              >
                <span className="text-foreground flex items-center gap-2 min-w-0">
                  <span className="bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-md text-xs flex-shrink-0 min-w-[28px] text-center">
                    {item.quantity}×
                  </span>
                  <span className="truncate">{item.product_name}</span>
                  {item.orderCount > 1 && (
                    <span
                      className="text-[10px] text-muted-foreground/70 flex-shrink-0"
                      title={`${item.orderCount} pedidos somados`}
                    >
                      ({item.orderCount}×)
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground font-medium flex-shrink-0 ml-2">
                  €{item.total.toFixed(2)}
                </span>
              </div>
            ))
          )}

          {/* Notas consolidadas */}
          {allNotes.length > 0 && (
            <div className="pt-2 space-y-1.5">
              {allNotes.map((n, i) => (
                <div
                  key={i}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 flex items-start gap-2"
                >
                  <MessageSquare className="w-3 h-3 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300 font-medium flex-1 min-w-0">
                    {n.note}
                  </p>
                  {n.time && (
                    <span className="text-[10px] text-yellow-400/60 flex-shrink-0">
                      {formatTime(new Date(n.time).getTime())}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Erro ao limpar */}
          {error && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Rodapé — Total + botão Limpar Mesa (sempre visível) */}
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
