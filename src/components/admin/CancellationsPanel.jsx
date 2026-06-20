// src/components/admin/CancellationsPanel.jsx
// -------------------------------------------------------------
// Vista de Auditoria — Registo de Cancelamentos.
//
// Lista todos os itens anulados (estornados) da noite, organizados
// por mesa, mostrando quem foi o staff que cancelou e a que horas.
//
// Previne perdas: o dono do bar pode ver padrões de cancelamento
// suspeitos (ex: sempre o mesmo staff a cancelar itens caros).
// -------------------------------------------------------------

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  User,
  Wine,
  Euro,
} from "lucide-react";
import { listCancellations } from "@/lib/db";

export default function CancellationsPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCancellations(200);
      setOrders(data);
    } catch (err) {
      setError("Não foi possível carregar os cancelamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Achata todos os canceled_items numa lista única para resumo
  const allCanceled = orders.flatMap((o) =>
    (o.canceled_items || []).map((ci) => ({
      ...ci,
      order_id: o.id,
      table: o.table || o.table_number || "?",
      order_created: o.created_date,
    }))
  );

  const totalCanceled = allCanceled.reduce(
    (s, ci) => s + (Number(ci.total) || 0),
    0
  );

  // Agrupa por staff (para ver quem cancela mais)
  const byStaff = allCanceled.reduce((acc, ci) => {
    const email = ci.canceled_by_email || "Desconhecido";
    if (!acc[email]) acc[email] = { count: 0, total: 0 };
    acc[email].count += 1;
    acc[email].total += Number(ci.total) || 0;
    return acc;
  }, {});

  const formatTime = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">A carregar cancelamentos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Registo de Cancelamentos
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {allCanceled.length} item(s) anulado(s) · €{totalCanceled.toFixed(2)} em estornos
          </p>
        </div>
        <button
          onClick={load}
          title="Atualizar"
          className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Resumo por staff */}
      {Object.keys(byStaff).length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
            Resumo por funcionário
          </p>
          <div className="space-y-2">
            {Object.entries(byStaff)
              .sort(([, a], [, b]) => b.total - a.total)
              .map(([email, data]) => (
                <div key={email} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium">{email}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {data.count} item(s) · <span className="text-red-400 font-medium">€{data.total.toFixed(2)}</span>
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Lista de cancelamentos por mesa */}
      {allCanceled.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border/50 rounded-2xl">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Sem cancelamentos registados.</p>
          <p className="text-xs mt-1 opacity-70">
            Os itens anulados pelo staff aparecem aqui para auditoria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const canceled = order.canceled_items || [];
            if (canceled.length === 0) return null;
            const table = order.table || order.table_number || "?";
            const orderTotal = canceled.reduce(
              (s, ci) => s + (Number(ci.total) || 0),
              0
            );

            return (
              <div
                key={order.id}
                className="bg-card border border-yellow-500/20 rounded-2xl overflow-hidden"
              >
                {/* Header do pedido */}
                <div className="flex items-center justify-between px-4 py-3 bg-yellow-500/5 border-b border-yellow-500/20">
                  <div className="flex items-center gap-2">
                    <Wine className="w-4 h-4 text-yellow-400" />
                    <p className="font-bold text-sm">Mesa {table}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {canceled.length} item(s) anulado(s)
                    </span>
                  </div>
                  <p className="text-sm font-bold text-red-400">
                    -€{orderTotal.toFixed(2)}
                  </p>
                </div>

                {/* Itens cancelados */}
                <div className="divide-y divide-border/20">
                  {canceled.map((ci, i) => (
                    <div
                      key={i}
                      className="px-4 py-2.5 flex items-center justify-between text-sm"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-semibold">
                            {ci.quantity}×
                          </span>
                          <span className="text-foreground truncate">
                            {ci.product_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {ci.canceled_by_email || "Desconhecido"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatDate(ci.canceled_at)} {formatTime(ci.canceled_at)}
                          </span>
                        </div>
                      </div>
                      <span className="text-red-400 font-medium flex-shrink-0 ml-2">
                        -€{Number(ci.total).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
