import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardList,
  Wine,
  BellRing,
  BellOff,
  History,
  Receipt,
  LogOut,
  RotateCcw,
  Calendar,
  ChevronDown,
} from "lucide-react";
import TableTab from "@/components/admin/TableTab";
import { useBarSettings } from "@/lib/BarSettingsContext";
import { useAuth } from "@/lib/AuthContext";
import { useOrderNotification } from "@/hooks/useOrderNotification";
import {
  subscribeOpenOrders,
  loadClosedOrdersPage,
  reopenTableOrders,
} from "@/lib/db";

export default function Staff() {
  // === Estado das mesas abertas (tab_status="open") ===
  const [openOrders, setOpenOrders] = useState([]);
  const [loadingOpen, setLoadingOpen] = useState(true);

  // === Estado do histórico (tab_status="closed") ===
  const [closedOrders, setClosedOrders] = useState([]);
  const [loadingClosed, setLoadingClosed] = useState(true);

  // === UI state ===
  const [view, setView] = useState("open"); // "open" | "history"
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  // Filtro do histórico: "today" (default) | "yesterday" | "week"
  const [historyFilter, setHistoryFilter] = useState("today");
  const soundEnabledRef = useRef(true);
  const knownIdsRef = useRef(new Set());

  const { settings } = useBarSettings();
  const { user, logout } = useAuth();
  const { playSound } = useOrderNotification();

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // -------------------------------------------------------------
  // Subscrição: mesas abertas (tab_status="open")
  // -------------------------------------------------------------
  useEffect(() => {
    console.info("[Staff] A subscrever mesas ABERTAS (tab_status=open)...");

    const unsubscribe = subscribeOpenOrders((event) => {
      console.info("[Staff][open] Evento:", event.type, event.id || "");

      if (event.type === "snapshot") {
        console.info(`[Staff][open] Snapshot: ${event.data.length} pedidos.`);
        setOpenOrders(event.data);
        event.data.forEach((o) => knownIdsRef.current.add(o.id));
        setLoadingOpen(false);
      } else if (event.type === "create") {
        // Só dispara som/alerta se for um pedido NOVO (id desconhecido)
        if (knownIdsRef.current.has(event.id)) return;
        knownIdsRef.current.add(event.id);
        console.info(
          `[Staff][open] ✨ Novo pedido: mesa ${event.data?.table}, €${event.data?.total_amount}`
        );
        setOpenOrders((prev) => {
          if (prev.some((o) => o.id === event.id)) return prev;
          return [event.data, ...prev];
        });
        setNewOrderAlert(true);
        setNewOrderCount((c) => c + 1);
        if (soundEnabledRef.current) playSound();
        setTimeout(() => setNewOrderAlert(false), 6000);
      } else if (event.type === "update") {
        setOpenOrders((prev) =>
          prev.map((o) => (o.id === event.id ? event.data : o))
        );
      } else if (event.type === "delete") {
        // Quando o staff clica em "Limpar Mesa", o pedido recebe
        // tab_status="closed" — o onSnapshot de "open" emite um
        // "removed" para esse documento. Removemo-lo do estado.
        knownIdsRef.current.delete(event.id);
        setOpenOrders((prev) => prev.filter((o) => o.id !== event.id));
      }
    });

    return () => {
      console.info("[Staff] A cancelar subscrição de mesas abertas.");
      unsubscribe();
    };
  }, [playSound]);

  // -------------------------------------------------------------
  // Histórico (tab_status="closed") — paginação sob demanda
  // -------------------------------------------------------------
  // Em vez de carregar todos os pedidos fechados de uma vez com
  // onSnapshot (que esgota as reads gratuitas do Firestore),
  // carregamos 20 de cada vez com getDocs + limit + startAfter.
  // O utilizador clica "Carregar Mais" para buscar a página seguinte.
  const [closedCursor, setClosedCursor] = useState(null);
  const [hasMoreClosed, setHasMoreClosed] = useState(true);
  const [loadingMoreClosed, setLoadingMoreClosed] = useState(false);

  const loadClosedPage = useCallback(
    async (replace = false) => {
      if (loadingMoreClosed) return;
      setLoadingMoreClosed(true);
      try {
        const cursor = replace ? null : closedCursor;
        const result = await loadClosedOrdersPage(cursor, 20);

        if (replace) {
          setClosedOrders(result.items);
        } else {
          setClosedOrders((prev) => [...prev, ...result.items]);
        }

        setClosedCursor(result.nextCursor);
        setHasMoreClosed(result.hasMore);
        setLoadingClosed(false);
      } catch (err) {
        console.error("[Staff] Erro ao carregar histórico:", err);
        setLoadingClosed(false);
      } finally {
        setLoadingMoreClosed(false);
      }
    },
    [closedCursor, loadingMoreClosed]
  );

  // Carrega a primeira página do histórico quando o utilizador
  // muda para a vista de histórico
  useEffect(() => {
    if (view === "history" && closedOrders.length === 0 && !loadingClosed) {
      loadClosedPage(true);
    }
  }, [view, closedOrders.length, loadingClosed, loadClosedPage]);

  // Recarrega a primeira página quando o filtro de data muda
  useEffect(() => {
    if (view === "history") {
      setClosedCursor(null);
      setHasMoreClosed(true);
      loadClosedPage(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyFilter]);

  // -------------------------------------------------------------
  // Agrupar pedidos abertos por mesa
  // -------------------------------------------------------------
  const tableGroups = useMemo(() => {
    const groups = {};
    for (const order of openOrders) {
      // Usa `table` (novo campo); fallback para `table_number` (legacy)
      const key = order.table || order.table_number || "1";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    return groups;
  }, [openOrders]);

  const sortedTables = useMemo(() => {
    return Object.keys(tableGroups).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });
  }, [tableGroups]);

  // -------------------------------------------------------------
  // Agrupar histórico por mesa (mostra última conta fechada)
  // -------------------------------------------------------------
  const closedGroups = useMemo(() => {
    const groups = {};
    for (const order of closedOrders) {
      const key = order.table || order.table_number || "1";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    // Para cada mesa, ordena por data de fecho (desc) e agrupa por sessão
    // de fecho (mesmo `closed_at` = mesma conta fechada).
    Object.values(groups).forEach((orders) => {
      orders.sort((a, b) => {
        const aT = a.closed_at
          ? new Date(a.closed_at).getTime()
          : a.created_date
          ? new Date(a.created_date).getTime()
          : 0;
        const bT = b.closed_at
          ? new Date(b.closed_at).getTime()
          : b.created_date
          ? new Date(b.created_date).getTime()
          : 0;
        return bT - aT;
      });
    });
    return groups;
  }, [closedOrders]);

  // Lista de "contas fechadas" — agrupa por (table + closed_at) e
  // aplica filtro de data (Hoje / Ontem / Esta Semana).
  const closedSessions = useMemo(() => {
    // === Cálculo dos limites de data para o filtro ===
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const endOfYesterday = new Date(startOfToday); // = início de hoje

    const startOfWeek = new Date(startOfToday);
    // Últimos 7 dias incluindo hoje (semana rolante, não semana calendário)
    startOfWeek.setDate(startOfWeek.getDate() - 6);

    // Determina os limites conforme o filtro ativo
    let startMs, endMs;
    if (historyFilter === "today") {
      startMs = startOfToday.getTime();
      endMs = now.getTime();
    } else if (historyFilter === "yesterday") {
      startMs = startOfYesterday.getTime();
      endMs = endOfYesterday.getTime();
    } else {
      // week — últimos 7 dias até agora
      startMs = startOfWeek.getTime();
      endMs = now.getTime();
    }

    // Filtra pedidos fechados dentro do intervalo
    const filteredOrders = closedOrders.filter((o) => {
      const ts = o.closed_at || o.updated_date || o.created_date;
      if (!ts) return false;
      const t = new Date(ts).getTime();
      return t >= startMs && t < endMs + (historyFilter === "today" || historyFilter === "week" ? 1 : 0);
    });

    // Agrupa por (table + closed_at)
    const sessions = [];
    const seen = new Set();

    filteredOrders.forEach((order) => {
      const key = `${order.table || order.table_number || "1"}__${order.closed_at || order.updated_date || ""}`;
      if (seen.has(key)) return;
      seen.add(key);
      const sessionOrders = filteredOrders.filter((o) => {
        const k = `${o.table || o.table_number || "1"}__${o.closed_at || o.updated_date || ""}`;
        return k === key;
      });
      const total = sessionOrders.reduce(
        (s, o) => s + (Number(o.total_amount) || 0),
        0
      );
      sessions.push({
        key,
        table: order.table || order.table_number || "1",
        closedAt: order.closed_at || order.updated_date,
        orders: sessionOrders,
        total,
      });
    });

    // Ordena por data de fecho desc
    sessions.sort((a, b) => {
      const aT = a.closedAt ? new Date(a.closedAt).getTime() : 0;
      const bT = b.closedAt ? new Date(b.closedAt).getTime() : 0;
      return bT - aT;
    });

    return sessions;
  }, [closedOrders, historyFilter]);

  // Soma total do histórico filtrado (para mostrar no header)
  const totalFechado = closedSessions.reduce(
    (s, sess) => s + (Number(sess.total) || 0),
    0
  );

  // -------------------------------------------------------------
  // Render
  // -------------------------------------------------------------
  const totalAberto = openOrders.reduce(
    (s, o) => s + (Number(o.total_amount) || 0),
    0
  );

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border px-4 pt-safe-top">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 min-w-0">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt="Logo"
                className="w-7 h-7 object-contain rounded flex-shrink-0"
              />
            ) : (
              <Wine className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-primary text-xs font-semibold tracking-widest uppercase truncate leading-none mb-0.5">
                {settings.bar_name || "Bar Nobre"}
              </p>
              <h1 className="font-playfair font-bold text-lg leading-none">
                Staff
              </h1>
            </div>
            {newOrderCount > 0 && (
              <button
                onClick={() => setNewOrderCount(0)}
                className="ml-1 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
              >
                {newOrderCount} novo{newOrderCount !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled((v) => !v)}
              title={soundEnabled ? "Desativar som" : "Ativar som"}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                soundEnabled
                  ? "bg-primary/20 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {soundEnabled ? (
                <BellRing className="w-4 h-4" />
              ) : (
                <BellOff className="w-4 h-4" />
              )}
            </button>
            <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs font-medium px-2.5 py-1.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
              </span>
              Live
            </div>
            {user && (
              <button
                onClick={() => logout()}
                title={`Terminar sessão (${user.email})`}
                className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-4 h-4 text-destructive" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs: Mesas Abertas / Histórico */}
        <div className="flex gap-1 -mb-px">
          <button
            onClick={() => setView("open")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              view === "open"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Receipt className="w-4 h-4" />
            Mesas Abertas
            {sortedTables.length > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  view === "open"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {sortedTables.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setView("history")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              view === "history"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <History className="w-4 h-4" />
            Histórico
            {closedSessions.length > 0 && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  view === "history"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {closedSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto">
        {/* === Vista: Mesas Abertas === */}
        {view === "open" && (
          <>
            {/* Banner de novo pedido */}
            <AnimatePresence>
              {newOrderAlert && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="bg-primary/20 border border-primary/50 text-primary rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-primary/10 mb-3"
                >
                  <BellRing className="w-4 h-4 animate-bounce flex-shrink-0" />
                  🔔 Novo pedido recebido!
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resumo */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">
                {sortedTables.length === 0
                  ? "Sem mesas abertas"
                  : `${sortedTables.length} mesa${sortedTables.length !== 1 ? "s" : ""} aberta${sortedTables.length !== 1 ? "s" : ""}`}
              </h2>
              {sortedTables.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Total em aberto:{" "}
                  <span className="text-primary font-bold">
                    €{totalAberto.toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            {loadingOpen ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 bg-card rounded-2xl animate-pulse border border-border/30"
                  />
                ))}
              </div>
            ) : sortedTables.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <ClipboardList className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Sem mesas abertas</p>
                <p className="text-xs mt-1 opacity-70">
                  Os novos pedidos do /menu aparecem aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedTables.map((table) => (
                  <TableTab
                    key={table}
                    tableNumber={table}
                    orders={tableGroups[table]}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* === Vista: Histórico === */}
        {view === "history" && (
          <>
            {/* Header + resumo */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-base">
                {closedSessions.length === 0
                  ? "Histórico vazio"
                  : `${closedSessions.length} conta${closedSessions.length !== 1 ? "s" : ""} fechada${closedSessions.length !== 1 ? "s" : ""}`}
              </h2>
              {closedSessions.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Total:{" "}
                  <span className="text-primary font-bold">
                    €{totalFechado.toFixed(2)}
                  </span>
                </p>
              )}
            </div>

            {/* Filtros de data: Hoje / Ontem / Esta Semana */}
            <div className="flex items-center gap-1 mb-3 bg-card border border-border/50 rounded-2xl p-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground ml-2 flex-shrink-0" />
              {[
                { value: "today", label: "Hoje" },
                { value: "yesterday", label: "Ontem" },
                { value: "week", label: "Esta Semana" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setHistoryFilter(opt.value)}
                  className={`flex-1 text-xs font-medium px-3 py-2 rounded-xl transition-colors ${
                    historyFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {loadingClosed ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-card rounded-2xl animate-pulse border border-border/30"
                  />
                ))}
              </div>
            ) : closedSessions.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <History className="w-14 h-14 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  Sem contas fechadas{" "}
                  {historyFilter === "today"
                    ? "hoje"
                    : historyFilter === "yesterday"
                    ? "ontem"
                    : "esta semana"}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  Quando fechares uma mesa no separador "Mesas Abertas",
                  ela aparece aqui.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {closedSessions.map((session) => (
                    <ClosedSessionCard
                      key={session.key}
                      table={session.table}
                      closedAt={session.closedAt}
                      orders={session.orders}
                      total={session.total}
                    />
                  ))}
                </div>

                {/* Botão Carregar Mais — paginação sob demanda */}
                {hasMoreClosed && (
                  <button
                    onClick={() => loadClosedPage(false)}
                    disabled={loadingMoreClosed}
                    className="w-full mt-4 flex items-center justify-center gap-2 bg-card border border-border/50 text-muted-foreground text-sm font-medium py-3 rounded-2xl hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {loadingMoreClosed ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                        A carregar...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Carregar Mais
                      </>
                    )}
                  </button>
                )}
                {!hasMoreClosed && closedSessions.length > 0 && (
                  <p className="text-center text-[10px] text-muted-foreground/50 mt-4">
                    Fim do histórico · {closedSessions.length} conta
                    {closedSessions.length !== 1 ? "s" : ""} carregada
                    {closedSessions.length !== 1 ? "s" : ""}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Subcomponente: Cartão de sessão fechada (histórico)
// -------------------------------------------------------------
function ClosedSessionCard({ table, closedAt, orders, total }) {
  const [expanded, setExpanded] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [error, setError] = useState("");

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

  // Lista consolidada de itens
  const consolidatedItems = orders.reduce((acc, order) => {
    for (const item of order.items || []) {
      const key = item.product_id || item.product_name;
      const existing = acc.find((i) => i.key === key);
      if (existing) {
        existing.quantity += Number(item.quantity) || 0;
        existing.total += Number(item.total) || 0;
      } else {
        acc.push({
          key,
          product_name: item.product_name,
          quantity: Number(item.quantity) || 0,
          total: Number(item.total) || 0,
        });
      }
    }
    return acc;
  }, []);

  // === Reabrir Mesa ===
  // Batch update: tab_status "closed" → "open" para todos os pedidos
  // desta sessão (mesma mesa + mesmo closed_at). A mesa reaparece
  // instantaneamente no ecrã principal (onSnapshot reage à mudança).
  const handleReopen = async (e) => {
    e.stopPropagation();
    const confirm = window.confirm(
      `Reabrir a Mesa ${table}?\n\n` +
        `${orders.length} pedido${orders.length !== 1 ? "s" : ""} desta conta ` +
        `voltará${orders.length !== 1 ? "ão" : "á"} para "Mesas Abertas".\n\n` +
        `Total: €${total.toFixed(2)}\n\n` +
        `Isto é útil se fechaste a mesa por engano ou se o cliente ` +
        `quer continuar a pedir.\n\n` +
        `Confirmar?`
    );
    if (!confirm) return;

    setReopening(true);
    setError("");
    try {
      console.info(
        `[Histórico] A reabrir Mesa ${table} (sessão ${closedAt}, ${orders.length} pedidos)...`
      );
      const result = await reopenTableOrders(table, {
        mode: "session",
        closedAt,
      });
      console.info(
        `[Histórico] Mesa ${table} reaberta: ${result.reopened} pedidos atualizados.`
      );
      // O onSnapshot de "open" e "closed" dispara automaticamente:
      // - Pedidos saem do histórico (subscribeClosedOrders)
      // - Pedidos entram nas mesas abertas (subscribeOpenOrders)
      // Não é preciso fazer nada aqui.
    } catch (err) {
      console.error(`[Histórico] Erro ao reabrir Mesa ${table}:`, err);
      setError(`Erro ao reabrir: ${err?.message || "verifica a consola."}`);
    } finally {
      setReopening(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden opacity-80 hover:opacity-100 transition-opacity"
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
            <Receipt className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-none">
              Mesa {table}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
              {closedAt ? (
                <>
                  <History className="w-2.5 h-2.5" />
                  Fechada às {formatTime(closedAt)} · {formatDate(closedAt)}
                </>
              ) : (
                `Sem data de fecho`
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider leading-none">
              Pago
            </p>
            <p className="font-bold text-foreground text-sm leading-none mt-0.5">
              €{total.toFixed(2)}
            </p>
          </div>
          {/* Botão Reabrir Mesa */}
          <button
            onClick={handleReopen}
            disabled={reopening}
            title="Reabrir esta conta (volta para Mesas Abertas)"
            className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/30 text-[10px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${reopening ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {reopening ? "A reabrir..." : "Reabrir"}
            </span>
          </button>
          {expanded ? (
            <ChevronUpSmall />
          ) : (
            <ChevronDownSmall />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 space-y-1 border-t border-border/30 pt-3">
          {consolidatedItems.map((item, i) => (
            <div
              key={`${item.key || i}`}
              className="flex justify-between text-xs"
            >
              <span className="text-foreground">
                <span className="text-primary font-semibold">
                  {item.quantity}×
                </span>{" "}
                {item.product_name}
              </span>
              <span className="text-muted-foreground font-medium">
                €{item.total.toFixed(2)}
              </span>
            </div>
          ))}
          {orders.some((o) => o.notes) && (
            <div className="pt-2 mt-2 border-t border-border/30 space-y-1">
              {orders
                .filter((o) => o.notes)
                .map((o, i) => (
                  <p key={i} className="text-[10px] text-yellow-400/70">
                    💬 {o.notes}
                  </p>
                ))}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground/60 pt-2">
            {orders.length} pedido{orders.length !== 1 ? "s" : ""} ·{" "}
            {formatTime(orders[orders.length - 1]?.created_date)} →{" "}
            {formatTime(orders[0]?.created_date)}
          </p>

          {/* Auditoria: quem fechou a conta + quando (timestamp legível) */}
          {(() => {
            // Todos os pedidos da sessão têm o mesmo closed_by_email
            // e closed_at (gravados no batch update). Lemos do primeiro.
            const first = orders[0] || {};
            const closedByEmail = first.closed_by_email || first.closed_by_uid;
            if (!closedByEmail && !closedAt) return null;

            // Formata o timestamp de fecho:
            //   - Se for hoje → só HH:MM  (ex: "23:45")
            //   - Se for outro dia → DD/MM - HH:MM  (ex: "15/06 - 23:45")
            let whenStr = "";
            if (closedAt) {
              const d = new Date(closedAt);
              const now = new Date();
              const isSameDay =
                d.getDate() === now.getDate() &&
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
              const hh = String(d.getHours()).padStart(2, "0");
              const mm = String(d.getMinutes()).padStart(2, "0");
              if (isSameDay) {
                whenStr = `${hh}:${mm}`;
              } else {
                const dd = String(d.getDate()).padStart(2, "0");
                const MM = String(d.getMonth() + 1).padStart(2, "0");
                whenStr = `${dd}/${MM} - ${hh}:${mm}`;
              }
            }

            return (
              <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1 flex-wrap">
                {closedByEmail ? (
                  <>
                    <span className="opacity-60">Fechado por:</span>
                    <span className="text-muted-foreground font-medium">
                      {closedByEmail}
                    </span>
                    {whenStr && (
                      <>
                        <span className="opacity-60">às</span>
                        <span className="text-muted-foreground font-medium">
                          {whenStr}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <span className="opacity-60">Fechada às</span>
                    <span className="text-muted-foreground font-medium">
                      {whenStr}
                    </span>
                  </>
                )}
              </p>
            );
          })()}

          {error && (
            <div className="mt-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-300">
              {error}
            </div>
          )}

          {/* Botão Reabrir Mesa (versão expandida, mais visível) */}
          <button
            onClick={handleReopen}
            disabled={reopening}
            className="w-full mt-2 flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/30 text-xs font-semibold py-2.5 rounded-xl hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${reopening ? "animate-spin" : ""}`} />
            {reopening ? "A reabrir mesa..." : "Reabrer Mesa"}
          </button>
          <p className="text-[10px] text-muted-foreground/60 text-center mt-1">
            A mesa volta para "Mesas Abertas" com todos os pedidos
            desta conta.
          </p>
        </div>
      )}
    </motion.div>
  );
}

function ChevronDownSmall() {
  return (
    <svg
      className="w-3 h-3 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function ChevronUpSmall() {
  return (
    <svg
      className="w-3 h-3 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 15l7-7 7 7"
      />
    </svg>
  );
}
