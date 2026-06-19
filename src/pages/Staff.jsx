import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Wine, BellRing, BellOff } from "lucide-react";
import TableGroup from "@/components/admin/TableGroup";
import { useBarSettings } from "@/lib/BarSettingsContext";
import { useOrderNotification } from "@/hooks/useOrderNotification";
import { subscribeOrders } from "@/lib/db";

export default function Staff() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const soundEnabledRef = useRef(true);
  const { settings } = useBarSettings();
  const { playSound } = useOrderNotification();

  // Mantém um ref do conjunto de ids conhecidos para detetar
  // novos pedidos (em vez de updates) e tocar o som apenas nesses.
  const knownIdsRef = useRef(new Set());

  // Keep ref in sync so the subscription closure always reads current value
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  // Carrega uma lista nova de pedidos (usada por onUpdate/onClearTable)
  const reloadOrders = useCallback(async () => {
    // A subscrição onSnapshot já mantém o estado sincronizado em
    // tempo real; este reload apenas força um loading state breve
    // para feedback visual ao limpar mesas.
    setLoading(true);
    try {
      // noop — a subscrição trata disso; apenas damos um delay curto
      await new Promise((r) => setTimeout(r, 120));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Subscrição em tempo real ao Firestore (onSnapshot).
    // A query está ordenada por created_date desc dentro de
    // `subscribeOrders`. Se essa query falhar (ex.: documentos
    // legacy sem created_date), o `subscribeOrders` faz fallback
    // automático para uma query sem orderBy e ordena no cliente.
    console.info("[Staff] A subscrever pedidos em tempo real...");

    const unsubscribe = subscribeOrders((event) => {
      console.info("[Staff] Evento recebido:", event.type, event.id || "");

      if (event.type === "snapshot") {
        // Carregamento inicial
        console.info(`[Staff] Snapshot inicial: ${event.data.length} pedidos.`);
        setOrders(event.data);
        event.data.forEach((o) => knownIdsRef.current.add(o.id));
        setLoading(false);
      } else if (event.type === "create") {
        // Novo pedido — toca som se ativado
        if (knownIdsRef.current.has(event.id)) {
          console.info(`[Staff] Pedido ${event.id} já conhecido — ignorado.`);
          return;
        }
        knownIdsRef.current.add(event.id);
        console.info(`[Staff] ✨ Novo pedido: mesa ${event.data?.table_number}, €${event.data?.total_amount}, status=${event.data?.status}`);
        setOrders((prev) => {
          // Evita duplicados caso o evento chegue duas vezes
          if (prev.some((o) => o.id === event.id)) return prev;
          return [event.data, ...prev];
        });
        setNewOrderAlert(true);
        setNewOrderCount((c) => c + 1);
        if (soundEnabledRef.current) playSound();
        setTimeout(() => setNewOrderAlert(false), 6000);
      } else if (event.type === "update") {
        console.info(`[Staff] Pedido ${event.id} atualizado (status=${event.data?.status}).`);
        setOrders((prev) =>
          prev.map((o) => (o.id === event.id ? event.data : o))
        );
      } else if (event.type === "delete") {
        console.info(`[Staff] Pedido ${event.id} apagado.`);
        knownIdsRef.current.delete(event.id);
        setOrders((prev) => prev.filter((o) => o.id !== event.id));
      }
    });

    return () => {
      console.info("[Staff] A cancelar subscrição de pedidos.");
      unsubscribe();
    };
  }, [playSound]);

  // Group active orders by table
  const activeOrders = orders.filter((o) => o.status !== "pronto_limpo");

  const tableGroups = activeOrders.reduce((acc, order) => {
    const key = order.table_number;
    if (!acc[key]) acc[key] = [];
    acc[key].push(order);
    return acc;
  }, {});

  const sortedTables = Object.keys(tableGroups).sort((a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  });

  return (
    <div className="min-h-screen bg-background pb-safe">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border px-4 pt-safe-top">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2 min-w-0">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-7 h-7 object-contain rounded flex-shrink-0" />
            ) : (
              <Wine className="w-5 h-5 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-primary text-xs font-semibold tracking-widest uppercase truncate leading-none mb-0.5">
                {settings.bar_name || "Bar Nobre"}
              </p>
              <h1 className="font-playfair font-bold text-lg leading-none">Staff</h1>
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
                soundEnabled ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"
              }`}
            >
              {soundEnabled ? <BellRing className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-xs font-medium px-2.5 py-1.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
              </span>
              Live
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-2xl mx-auto">
        {/* New order alert banner */}
        <AnimatePresence>
          {newOrderAlert && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="bg-primary/20 border border-primary/50 text-primary rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2 shadow-lg shadow-primary/10"
            >
              <BellRing className="w-4 h-4 animate-bounce flex-shrink-0" />
              🔔 Novo pedido recebido!
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section header */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-base">
            Mesas ativas{" "}
            <span className="text-primary font-bold">({sortedTables.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-card rounded-2xl animate-pulse border border-border/30" />
            ))}
          </div>
        ) : sortedTables.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <ClipboardList className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Sem pedidos ativos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedTables.map((table) => (
              <TableGroup
                key={table}
                tableNumber={table}
                orders={tableGroups[table]}
                onUpdate={reloadOrders}
                onClearTable={reloadOrders}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
