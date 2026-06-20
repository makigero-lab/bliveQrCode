import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, Euro, ShoppingBag, Calendar, Download } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, parseISO, isWithinInterval } from "date-fns";
import { pt } from "date-fns/locale";
import { toCsv, downloadCsv, formatDateTime, summarizeItems, csvFilename } from "@/lib/csv";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 text-sm shadow-lg">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="text-primary font-semibold">€{payload[0]?.value?.toFixed(2)}</p>
      <p className="text-muted-foreground text-xs">{payload[1]?.value} pedidos</p>
    </div>
  );
};

export default function SalesDashboard({ orders }) {
  const [range, setRange] = useState("7");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState(false);

  // Faturação = contas efetivamente fechadas pelo staff (tab_status="closed").
  // Pedidos abertos (tab_status="open") NÃO contam para faturação porque
  // ainda podem ser alterados/cancelados pelo cliente.
  const paidOrders = useMemo(
    () => orders.filter((o) => o.tab_status === "closed"),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (range === "custom" && startDate && endDate) {
      const start = startOfDay(parseISO(startDate));
      const end = endOfDay(parseISO(endDate));
      return paidOrders.filter((o) => {
        // Usa closed_at (data de fecho) se disponível; senão created_date.
        const ref = o.closed_at || o.created_date;
        return isWithinInterval(new Date(ref), { start, end });
      });
    }
    const days = parseInt(range);
    const cutoff = startOfDay(subDays(new Date(), days - 1));
    return paidOrders.filter((o) => {
      const ref = o.closed_at || o.created_date;
      return new Date(ref) >= cutoff;
    });
  }, [paidOrders, range, startDate, endDate]);

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

      // Constrói linhas do CSV
      const rows = Array.from(sessions.values()).map((session) => {
        const total = session.orders.reduce(
          (s, o) => s + (Number(o.total_amount) || 0),
          0
        );
        // Junta todos os itens de todos os pedidos da sessão
        const allItems = session.orders.flatMap((o) => o.items || []);
        // Staff que fechou (lê do primeiro pedido; todos têm o mesmo)
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

      downloadCsv(csv, csvFilename("relatorio-vendas"));
      console.info(
        `[SalesDashboard] CSV exportado: ${rows.length} sessões, ${filteredOrders.length} pedidos.`
      );
    } catch (err) {
      console.error("[SalesDashboard] Erro ao exportar CSV:", err);
      alert(`Erro ao exportar: ${err?.message || ""}`);
    } finally {
      setExporting(false);
    }
  };

  const chartData = useMemo(() => {
    const days = range === "custom" ? 30 : parseInt(range);
    const map = {};

    let start, end;
    if (range === "custom" && startDate && endDate) {
      start = parseISO(startDate);
      end = parseISO(endDate);
      let d = new Date(start);
      while (d <= end) {
        const key = format(d, "yyyy-MM-dd");
        map[key] = { date: format(d, "dd/MM", { locale: pt }), revenue: 0, orders: 0 };
        d = new Date(d.getTime() + 86400000);
      }
    } else {
      for (let i = days - 1; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "yyyy-MM-dd");
        map[key] = { date: format(d, days <= 7 ? "EEE" : "dd/MM", { locale: pt }), revenue: 0, orders: 0 };
      }
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
  }, [filteredOrders, range, startDate, endDate]);

  const totalRevenue = filteredOrders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

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
      .slice(0, 5);
  }, [filteredOrders]);

  return (
    <div className="space-y-5">
      {/* Filters + Exportar */}
      <div className="flex flex-wrap gap-2 items-center">
        {[
          { value: "7", label: "7 dias" },
          { value: "30", label: "30 dias" },
          { value: "90", label: "3 meses" },
          { value: "custom", label: "Personalizado" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setRange(opt.value)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
              range === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex gap-2 items-center w-full mt-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1"
            />
            <span className="text-muted-foreground text-xs">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 flex-1"
            />
          </div>
        )}
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

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Faturado", value: `€${totalRevenue.toFixed(2)}`, icon: Euro, color: "text-primary" },
          { label: "Pedidos", value: totalOrders, icon: ShoppingBag, color: "text-blue-400" },
          { label: "Ticket Médio", value: `€${avgTicket.toFixed(2)}`, icon: TrendingUp, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-card border border-border/50 rounded-2xl p-3 text-center">
            <kpi.icon className={`w-4 h-4 mx-auto mb-1 ${kpi.color}`} />
            <p className={`font-bold text-base ${kpi.color}`}>{kpi.value}</p>
            <p className="text-muted-foreground text-xs">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-card border border-border/50 rounded-2xl p-4">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" /> Vendas diárias
        </h3>
        {chartData.every((d) => d.revenue === 0) ? (
          <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
            Sem dados para o período selecionado
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barSize={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${v}`}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--primary)/0.1)" }} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="orders" fill="hsl(var(--primary)/0.3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Top Products */}
      {topProducts.length > 0 && (
        <div className="bg-card border border-border/50 rounded-2xl p-4">
          <h3 className="font-semibold text-sm mb-3">Top produtos</h3>
          <div className="space-y-2">
            {topProducts.map(([name, data], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs w-4">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-primary font-semibold">€{data.revenue.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(data.revenue / topProducts[0][1].revenue) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-muted-foreground text-xs w-8 text-right">{data.qty}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}