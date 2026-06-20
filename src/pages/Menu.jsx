import { useState, useEffect } from "react";
import { Wine, AlertTriangle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import CategoryTabs from "@/components/menu/CategoryTabs";
import ProductCard from "@/components/menu/ProductCard";
import CartDrawer from "@/components/menu/CartDrawer";
import { useBarSettings } from "@/lib/BarSettingsContext";
import { listAvailableProducts, getTableByMid } from "@/lib/db";

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("todos");
  const [cart, setCart] = useState({});
  const [showCart, setShowCart] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // === Validação da mesa via QR code seguro (?m=<id>) ===
  // Estado: "loading" | "valid" | "invalid"
  const [tableState, setTableState] = useState("loading");
  const [tableNumber, setTableNumber] = useState(null);
  const [tableError, setTableError] = useState("");

  const urlParams = new URLSearchParams(window.location.search);
  // ID seguro da mesa (hash de 8 chars na coleção `tables`)
  const mid = urlParams.get("m");
  // Legacy fallback: se o QR foi gerado antes desta feature,
  // aceita ?mesa=N ou ?table=N — mas mostra aviso.
  const legacyMesa = urlParams.get("mesa") || urlParams.get("table");

  const { settings } = useBarSettings();

  // Valida o ID da mesa na coleção `tables` do Firestore
  useEffect(() => {
    let cancelled = false;

    async function validateTable() {
      if (mid) {
        // Modo seguro: valida o ID na coleção `tables`
        try {
          const table = await getTableByMid(mid);
          if (cancelled) return;
          if (table) {
            setTableNumber(String(table.table_number));
            setTableState("valid");
          } else {
            setTableError(
              "Este QR code não corresponde a uma mesa registada. Pede ao staff um QR code válido."
            );
            setTableState("invalid");
          }
        } catch (err) {
          if (cancelled) return;
          setTableError(
            "Não foi possível validar a mesa. Verifica a tua ligação à internet."
          );
          setTableState("invalid");
        }
      } else if (legacyMesa) {
        // Modo legacy: aceita ?mesa=N / ?table=N com aviso.
        setTableNumber(String(legacyMesa));
        setTableState("valid");
      } else {
        // Sem ?m= nem ?mesa= — bloqueia.
        setTableError(
          "Falta o identificador da mesa. Acede ao menu através do QR code colocado na mesa."
        );
        setTableState("invalid");
      }
    }

    validateTable();

    return () => {
      cancelled = true;
    };
  }, [mid, legacyMesa]);

  // Carrega produtos (só se a mesa for válida)
  useEffect(() => {
    if (tableState !== "valid") return;
    let cancelled = false;

    listAvailableProducts()
      .then((data) => {
        if (cancelled) return;
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setProducts([]);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tableState]);

  const filtered = category === "todos"
    ? products
    : products.filter((p) => p.category === category);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const p = products.find((p) => p.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  const addToCart = (id) => setCart((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = (id, all = false) =>
    setCart((c) => {
      const qty = c[id] || 0;
      if (all || qty <= 1) {
        const n = { ...c };
        delete n[id];
        return n;
      }
      return { ...c, [id]: qty - 1 };
    });

  // === Ecrã: Mesa Inválida ===
  if (tableState === "invalid") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
        </motion.div>
        <h1 className="font-playfair font-bold text-2xl text-foreground">
          Mesa Inválida
        </h1>
        <p className="text-muted-foreground text-sm max-w-xs">
          {tableError}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Se precisas de ajuda, fala com o staff do bar.
        </p>
      </div>
    );
  }

  // === Ecrã: Loading (a validar mesa) ===
  if (tableState === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground">A validar mesa...</p>
      </div>
    );
  }

  // === Ecrã: Pedido Enviado ===
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
            <Wine className="w-12 h-12 text-primary" />
          </div>
        </motion.div>
        <h1 className="font-playfair font-bold text-3xl text-foreground">Obrigado!</h1>
        <p className="text-muted-foreground text-base max-w-xs">
          O teu pedido foi enviado. O staff irá trazer à mesa em breve!
        </p>
        <button
          onClick={() => { setCart({}); setOrderPlaced(false); }}
          className="mt-2 bg-primary text-primary-foreground px-8 py-3 rounded-2xl font-semibold hover:bg-primary/90 transition-colors"
        >
          Novo pedido
        </button>
      </div>
    );
  }

  // === Ecrã: Menu Principal ===
  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Aviso legacy (se entrou via ?mesa= em vez de ?m=) */}
      {legacyMesa && !mid && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-2 text-center">
          <p className="text-[11px] text-yellow-300">
            ⚠️ QR code desatualizado. Pede ao staff um novo QR code para esta mesa.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
        <div className="relative px-5 pt-12 pb-6">
          <div className="flex items-center gap-2 mb-1">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="w-6 h-6 object-contain rounded" />
            ) : (
              <Wine className="w-5 h-5 text-primary" />
            )}
            <span className="text-primary text-sm font-medium tracking-widest uppercase">
              {settings.bar_name || "Bar Nobre"}
            </span>
          </div>
          <h1 className="font-playfair font-bold text-4xl text-foreground">Menu</h1>
          {settings.tagline && <p className="text-muted-foreground text-xs mt-0.5">{settings.tagline}</p>}
          <p className="text-muted-foreground text-sm mt-1">Mesa {tableNumber}</p>
        </div>
      </div>

      {/* Divider */}
      <div className="px-5 mb-1">
        <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* Categories */}
      <div className="px-5 py-4">
        <CategoryTabs active={category} onChange={setCategory} />
      </div>

      {/* Products */}
      <div className="px-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-card rounded-xl h-52 animate-pulse border border-border/30" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-lg">Nenhum produto disponível</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={cart[product.id] || 0}
                onAdd={() => addToCart(product.id)}
                onRemove={() => removeFromCart(product.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart Button */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-5 right-5 z-30"
          >
            <button
              onClick={() => setShowCart(true)}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold flex items-center justify-between px-5 shadow-2xl shadow-primary/40 hover:bg-primary/90 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="bg-primary-foreground/20 rounded-full px-2 py-0.5 text-sm font-bold">
                  {cartCount}
                </div>
                <span>Ver pedido</span>
              </div>
              <span className="font-bold">€{cartTotal.toFixed(2)}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <CartDrawer
            cart={cart}
            products={products}
            tableNumber={tableNumber}
            onClose={() => setShowCart(false)}
            onAdd={addToCart}
            onRemove={removeFromCart}
            onOrderPlaced={() => { setShowCart(false); setOrderPlaced(true); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
