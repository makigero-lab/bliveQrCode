import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, RefreshCw, LayoutGrid, ClipboardList, QrCode, Trash2, Pencil, Wine, BarChart2, Settings, Wifi, PackageOpen, LineChart, Users, LogOut, Wrench, Lock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import OrderCard from "@/components/admin/OrderCard";
import ProductForm from "@/components/admin/ProductForm";
import SalesDashboard from "@/components/admin/SalesDashboard";
import SettingsPanel from "@/components/admin/SettingsPanel";
import QRCodesTab from "@/components/admin/QRCodesTab";
import StockPanel from "@/components/admin/StockPanel";
import AnalyticsPanel from "@/components/admin/AnalyticsPanel";
import ImportCatalogButton from "@/components/admin/ImportCatalogButton";
import ClearAllProductsButton from "@/components/admin/ClearAllProductsButton";
import ClearAllOrdersButton from "@/components/admin/ClearAllOrdersButton";
import BulkProductEditor from "@/components/admin/BulkProductEditor";
import UsersPanel from "@/components/admin/UsersPanel";
import BootstrapButton from "@/components/admin/BootstrapButton";
import { useBarSettings } from "@/lib/BarSettingsContext";
import { useAuth } from "@/lib/AuthContext";
import {
  listProducts,
  listOrders,
  createProduct,
  updateProduct,
  deleteProduct,
  subscribeOrders,
  closeTableOrders,
} from "@/lib/db";

// Tabs base — visíveis para todos os autenticados.
// "users" é adicionado condicionalmente se o user for admin (ver Admin()).
const ALL_TABS = [
  { id: "orders", label: "Pedidos", icon: ClipboardList, adminOnly: false },
  { id: "menu", label: "Menu", icon: LayoutGrid, adminOnly: false },
  { id: "stock", label: "Stock", icon: PackageOpen, adminOnly: false },
  { id: "analytics", label: "Analytics", icon: LineChart, adminOnly: false },
  { id: "sales", label: "Vendas", icon: BarChart2, adminOnly: false },
  { id: "qr", label: "QR", icon: QrCode, adminOnly: true },
  { id: "settings", label: "Config.", icon: Settings, adminOnly: true },
  { id: "users", label: "Utilizadores", icon: Users, adminOnly: true },
  { id: "system", label: "Sistema", icon: Wrench, adminOnly: true },
];

const statusOrder = ["pendente", "confirmado", "em_preparacao", "pronto", "pago"];

export default function Admin() {
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editProduct, setEditProduct] = useState(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  // Filtro do separador Pedidos: "open" (mesas ativas) | "closed" (histórico) | "all"
  const [ordersFilter, setOrdersFilter] = useState("open");
  const { settings } = useBarSettings();
  const { user, logout } = useAuth();
  const ordersRef = useRef([]);
  const knownIdsRef = useRef(new Set());

  // Tabs visíveis: filtra "adminOnly" se o user não for admin.
  // Como RequireAuth já bloqueia /admin para não-admins, em prática
  // o user aqui é sempre admin — mas mantemos o filtro por segurança.
  const tabs = ALL_TABS.filter((t) => !t.adminOnly || user?.role === "admin");

  const loadOrders = useCallback(async () => {
    try {
      const data = await listOrders(500);
      setOrders(data);
      ordersRef.current = data;
    } catch (err) {
      console.error("[Admin] Falha ao carregar pedidos:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const data = await listProducts();
      setProducts(data);
    } catch (err) {
      console.error("[Admin] Falha ao carregar produtos:", err);
      setProducts([]);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    loadProducts();

    // Subscrição em tempo real ao Firestore (onSnapshot).
    // A query está ordenada por created_date desc dentro de
    // `subscribeOrders`.
    const unsubscribe = subscribeOrders((event) => {
      if (event.type === "snapshot") {
        // Carregamento inicial — substitui tudo
        setOrders(event.data);
        ordersRef.current = event.data;
        event.data.forEach((o) => knownIdsRef.current.add(o.id));
        setLoading(false);
      } else if (event.type === "create") {
        if (knownIdsRef.current.has(event.id)) return;
        knownIdsRef.current.add(event.id);
        setOrders((prev) => {
          if (prev.some((o) => o.id === event.id)) return prev;
          return [event.data, ...prev];
        });
        setNewOrderAlert(true);
        setTimeout(() => setNewOrderAlert(false), 4000);
      } else if (event.type === "update") {
        setOrders((prev) =>
          prev.map((o) => (o.id === event.id ? event.data : o))
        );
      } else if (event.type === "delete") {
        knownIdsRef.current.delete(event.id);
        setOrders((prev) => prev.filter((o) => o.id !== event.id));
      }
    });

    return () => unsubscribe();
  }, [loadOrders, loadProducts]);

  // === Filtros de pedidos por tab_status (sistema de Contas por Mesa) ===
  // - "open"   → mesas ativas (contas abertas, ainda não pagas/fechadas)
  // - "closed" → histórico (contas fechadas pelo staff)
  // - "all"    → todos os pedidos (auditoria)
  //
  // Compatibilidade: pedidos antigos sem `tab_status` são tratados como
  // "open" (default aplicado no createOrder).
  const openOrders = orders.filter(
    (o) => !o.tab_status || o.tab_status === "open"
  );
  const closedOrders = orders.filter((o) => o.tab_status === "closed");

  // Lista a mostrar conforme o filtro ativo (default: "open")
  const filteredOrders =
    ordersFilter === "closed"
      ? closedOrders
      : ordersFilter === "all"
      ? orders
      : openOrders;

  // Mantemos activeOrders/doneOrders por compatibilidade com código
  // mais antigo que ainda os use, mas os gráficos e a UI agora usam
  // tab_status diretamente.
  const activeOrders = openOrders;
  const doneOrders = closedOrders;

  // === Fechar conta (batch update tab_status → closed) ===
  // Permite ao Admin fechar contas diretamente do painel, sem
  // precisar de ir ao /staff. Útil para supervisão.
  const [closingTables, setClosingTables] = useState(new Set());

  const handleCloseTableFromAdmin = async (tableNumber) => {
    const tableOrders = openOrders.filter(
      (o) => (o.table || o.table_number) === tableNumber
    );
    const total = tableOrders.reduce(
      (s, o) => s + (Number(o.total_amount) || 0),
      0
    );

    if (!window.confirm(
      `Fechar a conta da Mesa ${tableNumber}?\n\n` +
        `${tableOrders.length} pedido${tableOrders.length !== 1 ? "s" : ""}\n` +
        `Total: €${total.toFixed(2)}\n\nConfirmar?`
    )) return;

    setClosingTables((prev) => new Set([...prev, tableNumber]));
    try {
      await closeTableOrders(tableNumber, user);
      console.info(`[Admin] Mesa ${tableNumber} fechada pelo admin ${user?.email}.`);
      await loadOrders();
    } catch (err) {
      console.error(`[Admin] Erro ao fechar mesa ${tableNumber}:`, err);
      alert(`Erro: ${err?.message || ""}`);
    } finally {
      setClosingTables((prev) => {
        const next = new Set(prev);
        next.delete(tableNumber);
        return next;
      });
    }
  };

  // Agrupar pedidos abertos por mesa (para vista "Mesas Abertas" no Admin)
  const adminTableGroups = useMemo(() => {
    if (ordersFilter !== "open") return {};
    const groups = {};
    for (const order of openOrders) {
      const key = order.table || order.table_number || "1";
      if (!groups[key]) groups[key] = [];
      groups[key].push(order);
    }
    return groups;
  }, [openOrders, ordersFilter]);

  const adminSortedTables = Object.keys(adminTableGroups).sort((a, b) => {
    const numA = parseInt(a) || 0;
    const numB = parseInt(b) || 0;
    return numA - numB;
  });

  const handleDeleteProduct = async (id) => {
    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err) {
      console.error("[Admin] Erro ao apagar produto:", err);
    }
  };

  const toggleAvailability = async (product) => {
    try {
      await updateProduct(product.id, { available: !product.available });
      await loadProducts();
    } catch (err) {
      console.error("[Admin] Erro ao atualizar disponibilidade:", err);
    }
  };

  const baseUrl = window.location.origin + window.location.pathname.replace("/admin", "/menu");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 pt-safe-top pb-3 flex items-center gap-2">
        {settings.logo_url ? (
          <img src={settings.logo_url} alt="Logo" className="w-7 h-7 object-contain rounded flex-shrink-0" />
        ) : (
          <Wine className="w-5 h-5 text-primary flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-primary text-xs font-semibold tracking-widest uppercase leading-none mb-0.5">
            {settings.bar_name || "Bar Nobre"}
          </p>
          <h1 className="font-playfair font-bold text-lg leading-none">Gestão</h1>
        </div>
        {/* User info + logout */}
        {user && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground leading-none mb-0.5">
                {user.email}
              </p>
              <p className="text-[9px] uppercase tracking-wider font-medium text-primary leading-none">
                {user.role}
              </p>
            </div>
            <button
              onClick={() => logout()}
              title="Terminar sessão"
              className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
            >
              <LogOut className="w-4 h-4 text-destructive" />
            </button>
          </div>
        )}
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div className="flex border-b border-border bg-card overflow-x-auto scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 text-xs font-medium transition-colors relative ${
              tab === t.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
            {tab === t.id && (
              <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* ORDERS TAB — filtros por tab_status (Contas por Mesa) */}
        {tab === "orders" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">
                {ordersFilter === "open" && `Mesas Abertas`}
                {ordersFilter === "closed" && `Contas Fechadas`}
                {ordersFilter === "all" && `Todos os Pedidos`}
                {" "}
                <span className="text-primary">({filteredOrders.length})</span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"></span>
                  </span>
                  Em direto
                </div>
                <button onClick={loadOrders} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <RefreshCw className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Filtros: Mesas Abertas / Contas Fechadas / Todos */}
            <div className="flex items-center gap-1 bg-card border border-border/50 rounded-2xl p-1">
              {[
                { value: "open", label: "Mesas Abertas", count: openOrders.length, color: "bg-primary" },
                { value: "closed", label: "Contas Fechadas", count: closedOrders.length, color: "bg-green-500" },
                { value: "all", label: "Todos", count: orders.length, color: "bg-secondary" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOrdersFilter(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2 py-2 rounded-xl transition-colors ${
                    ordersFilter === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {opt.label}
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      ordersFilter === opt.value
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {opt.count}
                  </span>
                </button>
              ))}
            </div>

            {newOrderAlert && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="bg-primary/20 border border-primary/40 text-primary rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2"
              >
                <span className="text-lg">🔔</span> Novo pedido recebido!
              </motion.div>
            )}

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-36 bg-card rounded-2xl animate-pulse border border-border/30" />
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>
                  {ordersFilter === "open" && "Sem mesas abertas"}
                  {ordersFilter === "closed" && "Sem contas fechadas"}
                  {ordersFilter === "all" && "Sem pedidos"}
                </p>
                <p className="text-xs mt-1 opacity-70">
                  {ordersFilter === "open" && "Os novos pedidos do /menu aparecem aqui automaticamente."}
                  {ordersFilter === "closed" && "Quando o staff fecha uma mesa no /staff, a conta aparece aqui."}
                  {ordersFilter === "all" && "Pedidos aparecerão aqui assim que forem criados no /menu."}
                </p>
              </div>
            ) : ordersFilter === "open" ? (
              /* Vista Mesas Abertas: agrupado por mesa com botão Fechar Conta */
              <div className="space-y-4">
                {adminSortedTables.map((table) => {
                  const tableOrders = adminTableGroups[table];
                  const tableTotal = tableOrders.reduce(
                    (s, o) => s + (Number(o.total_amount) || 0),
                    0
                  );
                  const isClosing = closingTables.has(table);
                  return (
                    <div
                      key={table}
                      className="bg-card border border-primary/30 border-l-4 border-l-green-500 rounded-2xl overflow-hidden"
                    >
                      {/* Header da mesa */}
                      <div className="flex items-center justify-between px-4 py-3 bg-primary/5 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <Wine className="w-4 h-4 text-primary" />
                          <p className="font-playfair font-bold text-base">
                            Mesa {table}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {tableOrders.length} pedido{tableOrders.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-primary text-sm">
                            €{tableTotal.toFixed(2)}
                          </p>
                          <button
                            onClick={() => handleCloseTableFromAdmin(table)}
                            disabled={isClosing}
                            className="flex items-center gap-1 bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                          >
                            <Lock className="w-3 h-3" />
                            {isClosing ? "A fechar..." : "Fechar Conta"}
                          </button>
                        </div>
                      </div>
                      {/* Pedidos da mesa */}
                      <div className="divide-y divide-border/30">
                        {tableOrders.map((o) => (
                          <OrderCard key={o.id} order={o} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((o) => (
                  <OrderCard key={o.id} order={o} />
                ))}
              </div>
            )}

            {/* Ação destrutiva: limpar todos os pedidos (dados de teste) */}
            <div className="mt-6 pt-4 border-t border-border/40">
              <ClearAllOrdersButton onCleared={loadOrders} />
            </div>
          </div>
        )}

        {/* MENU TAB */}
        {tab === "menu" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold text-lg">Produtos</h2>
              <button
                onClick={() => { setEditProduct(null); setShowProductForm(true); }}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" /> Adicionar
              </button>
            </div>

            {/* Ações de catálogo: Importar (esquerda) + Apagar tudo (direita) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ImportCatalogButton onImported={loadProducts} />
              <ClearAllProductsButton onCleared={loadProducts} />
            </div>

            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3">
                  {p.image_url && (
                    <img src={p.image_url} alt={p.name} className="w-14 h-14 rounded-xl object-cover" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-muted-foreground text-xs">{p.category}</p>
                    <p className="text-primary font-semibold text-sm">€{p.price?.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => toggleAvailability(p)}
                    title={p.available ? "Clica para desativar" : "Clica para ativar"}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                      p.available
                        ? "bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400"
                        : "bg-red-500/15 text-red-400 hover:bg-green-500/15 hover:text-green-400"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${p.available ? "bg-green-400" : "bg-red-400"}`} />
                    {p.available ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => { setEditProduct(p); setShowProductForm(true); }}
                    className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80"
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDeleteProduct(p.id)}
                    className="w-8 h-8 rounded-xl bg-destructive/10 flex items-center justify-center hover:bg-destructive/20"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </div>
              ))}
            </div>

            {/* Editor visual em massa — para trocar URLs de imagens
                (ex.: colar URL de foto do Instagram do B'Live) sem
                mexer no código. */}
            <div className="mt-6 pt-4 border-t border-border/40">
              <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                Editor visual de produtos
              </h3>
              <p className="text-muted-foreground text-xs mb-4">
                Edita todos os campos inline (nome, descrição, preço,
                categoria, <strong className="text-primary">URL da imagem</strong>,
                stock, disponibilidade). Botão "Guardar linha" para um
                produto; "Guardar tudo" para persistir todas as alterações
                de uma só vez.
              </p>
              <BulkProductEditor />
            </div>
          </div>
        )}

        {/* STOCK TAB */}
        {tab === "stock" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Gestão de Stock</h2>
              <p className="text-muted-foreground text-sm mt-1">Produtos com stock a zero ficam automaticamente indisponíveis.</p>
            </div>
            <StockPanel />
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Analytics</h2>
              <p className="text-muted-foreground text-sm mt-1">Dados baseados nos pedidos pagos.</p>
            </div>
            <AnalyticsPanel orders={orders} />
          </div>
        )}

        {/* SALES TAB */}
        {tab === "sales" && (
          <SalesDashboard orders={orders} />
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && <SettingsPanel />}

        {/* QR TAB */}
        {tab === "qr" && <QRCodesTab baseUrl={baseUrl} />}

        {/* USERS TAB — só visível para admin (filtro em `tabs` acima) */}
        {tab === "users" && <UsersPanel />}

        {/* SYSTEM TAB — setup inicial, bootstrap, diagnóstico */}
        {tab === "system" && (
          <div className="space-y-4">
            <div>
              <h2 className="font-semibold text-lg">Sistema</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Ferramentas de setup e diagnóstico da base de dados.
              </p>
            </div>
            <BootstrapButton />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showProductForm && (
          <ProductForm
            product={editProduct}
            onClose={() => setShowProductForm(false)}
            onSaved={() => { setShowProductForm(false); loadProducts(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
