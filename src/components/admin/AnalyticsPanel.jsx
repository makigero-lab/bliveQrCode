import { useMemo, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import { format, subDays, startOfDay, parseISO, isWithinInterval, endOfDay } from "date-fns";
import { pt } from "date-fns/locale";
import { TrendingUp, Euro, ShoppingBag, Clock, Download } from "lucide-react";
import { toCsv, downloadCsv, formatDateTime, summarizeItems, csvFilename } from "@/lib/csv";

const TooltipBox = ({ active, payload, label, prefix = "", suffix = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-primary font-semibold">{prefix}{typeof payload[0]?.value === "number" ? payload[0].value.toFixed(prefix === "€" ? 2 : 0) : payload[0]?.value}{suffix}</p>
    </div>
  );
};

const RANGES = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "3 meses" },
];

export default function AnalyticsPanel({ orders }) {
  const [range, setRange] = useState("7");
  const [exporting, setExporting] = useState(false);

  // Faturação = contas efetivamente fechadas pelo staff (tab_status="closed").
  // Pedidos abertos (tab_status="open") NÃO contam para faturação porque
  // ainda podem ser alterados/cancelados pelo cliente.
  const paidOrders = useMemo(
    () => orders.filter((o) => o.tab_status === "closed"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const days = parseInt(range);
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return paidOrders.filter((o) => {
      const ref = o.closed_at || o.created_date;
      return new Date(ref) >= cutoff;
    });
  }, [paidOrders, range]);

  // === Exportar CSV ===
  const handleExportCsv = async () => {
    if (filteredOrders.length === 0) {
      alert("Sem pedidos para exportar no período selecionado.");
      return;
    }

    setExporting(true);
    try {
      // Agrupa por sessão fechada (mesa + closed_at) — uma linha por conta.
      const sessions = new Map();
      for (const o of filteredOrders) {
        const key = `${o.table || o.table_number || "1"}__${o.closed_at || o.updated_date || ""}`;
        if (!sessions.has(key)) {
          sessions.set(key, {
            table: o.table || o.table_number || "1",
            closed_at: o.closed_at || o.updated_date || o.created_date,
            orders: [],
          });
        }
        sessions.get(key).orders.push(o);
      }

      const rows = Array.from(sessions.values()).map((session) => {
        const total = session.orders.reduce(
          (s, o) => s + (Number(o.total_amount) || 0),
          0
        );
        const allItems = session.orders.flatMap((o) => o.items || []);
        const closedBy =
          session.orders[0]?.closed_by_email ||
          session.orders[0]?.closed_by_uid ||
          "";

        return {
          data_hora: session.closed_at,
          mesa: session.table,
          total: total,
          itens: allItems,
          staff: closedBy,
        };
      });

      const csv = toCsv(rows, [
        {
          key: "data_hora",
          label: "Data/Hora",
          format: (v) => formatDateTime(v),
        },
        { key: "mesa", label: "Mesa" },
        {
          key: "total",
          label: "Total Pago (EUR)",
          format: (v) => Number(v).toFixed(2).replace(".", ","),
        },
        {
          key: "itens",
          label: "Produtos",
          format: (v) => summarizeItems(v),
        },
        { key: "staff", label: "Staff que fechou" },
      ]);

      downloadCsv(csv, csvFilename("analytics-pedidos"));
      console.info(
        `[AnalyticsPanel] CSV exportado: ${rows.length} sessões, ${filteredOrders.length} pedidos.`
      );
    } catch (err) {
      console.error("[AnalyticsPanel] Erro ao exportar CSV:", err);
      alert(`Erro ao exportar: ${err?.message || ""}`);
    } finally {
      setExporting(false);
    }
  };

  // KPIs
  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Faturação diária
  const dailyData = useMemo(() => {
    const days = parseInt(range);
    const map = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const key = format(d, "yyyy-MM-dd");
      map[key] = {
        date: format(d, days <= 7 ? "EEE" : "dd/MM", { locale: pt }),
        revenue: 0,
        orders: 0,
      };
    }
    filteredOrders.forEach((o) => {
      // Usa closed_at como referência (data de fecho) se disponível;
      // senão created_date (legacy).
      const ref = o.closed_at || o.created_date;
      const key = format(new Date(ref), "yyyy-MM-dd");
      if (map[key]) {
        map[key].revenue += o.total_amount || 0;
        map[key].orders += 1;
      }
    });
    return Object.values(map);
  }, [filteredOrders, range]);

  // Top produtos
  const topProducts = useMemo(() => {
    const map = {};
    filteredOrders.forEach((o) => {
      o.items?.forEach((item) => {
        if (!map[item.product_name]) map[item.product_name] = { qty: 0, revenue: 0 };
        map[item.product_name].qty += item.quantity || 0;
        map[item.product_name].revenue += item.total || 0;
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 8)
      .map(([name, data]) => ({ name: name.length > 14 ? name.slice(0, 13) + "…" : name, ...data }));
  }, [filteredOrders]);

  // Volume por hora
  const hourlyData = useMemo(() => {
    const map = {};
    for (let h = 0; h < 24; h++) {
      map[h] = { hour: `${String(h).padStart(2, "0")}h`, orders: 0 };
    }
    filteredOrders.forEach((o) => {
      // Volume por hora baseado na data de fecho (ou criação legacy)
      const ref = o.closed_at || o.created_date;
      const h = new Date(ref).getHours();
      map[h].orders += 1;
    });
    // Only show hours with activity ±2h buffer
    const active = Object.values(map).filter((d) => d.orders > 0);
    if (active.length === 0) return Object.values(map);
    const minH = Math.max(0, Math.min(...active.map((_, i) => Object.keys(map).findIndex((k) => map[k] === _))) - 2);
    const maxH = Math.min(23, Math.max(...active.map((_, i) => Object.keys(map).findIndex((k) => map[k] === _))) + 2);
    return Object.values(map).slice(minH, maxH + 1);
  }, [filteredOrders]);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(38 80% 60%)",
    "hsl(38 70% 50%)",
    "hsl(33 65% 45%)",
    "hsl(28 60% 40%)",
    "hsl(23 55% 35%)",
    "hsl(18 50% 30%)",
    "hsl(13 45% 25%)",
  ];

  return (
    <div className="space-y-5">
      {/* Range selector + Exportar */}
      <div className="flex flex-wrap gap-2 items-center">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              range === r.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
        {/* Botão Exportar CSV — alinhado à direita */}
        <div className="ml-auto">
          <button
            onClick={handleExportCsv}
            disabled={exporting || filteredOrders.length === 0}
            title={
              filteredOrders.length === 0
                ? "Sem pedidos para exportar"
                : `Exportar ${filteredOrders.length} pedido(s) para CSV`
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "A exportar..." : "Exportar CSV"}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Faturado", value: `€${totalRevenue.toFixed(2)}`, icon: Euro, color: "text-primary" },
          { label: "Pedidos", value: totalOrders, icon: ShoppingBag, color: "text-blue-400" },
          { label: "Ticket Médio", value: `€${avgTicket.toFixed(2)}`, icon: TrendingUp, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
            <kpi.icon className={`w-4 h-4 mx-auto mb-1 ${kpi.color}`} />
            <p className={`font-bold text-sm ${kpi.color}`}>{kpi.value}</p>
            <p className="text-muted-foreground text-xs">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Faturação diária */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Euro className="w-4 h-4 text-primary" /> Faturação diária
        </h3>
        {dailyData.every((d) => d.revenue === 0) ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} width={42} />
              <Tooltip content={<TooltipBox prefix="€" />} />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top produtos */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Produtos mais vendidos
        </h3>
        {topProducts.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={topProducts} layout="vertical" barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<TooltipBox prefix="€" />} />
              <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                {topProducts.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume por hora */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Volume de pedidos por hora
        </h3>
        {filteredOrders.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={hourlyData} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="hour" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<TooltipBox suffix=" pedidos" />} />
              <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} fillOpacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}