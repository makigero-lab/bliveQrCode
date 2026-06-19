import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Minus, PackageX } from "lucide-react";

export default function StockPanel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await base44.entities.Product.list();
    setProducts(data.filter((p) => p.stock_enabled));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const adjustStock = async (product, delta) => {
    const newStock = Math.max(0, (product.stock || 0) + delta);
    const updates = { stock: newStock };
    if (newStock === 0) updates.available = false;
    if (newStock > 0 && !product.available) updates.available = true;
    await base44.entities.Product.update(product.id, updates);
    load();
  };

  const setStock = async (product, value) => {
    const newStock = Math.max(0, parseInt(value) || 0);
    const updates = { stock: newStock };
    if (newStock === 0) updates.available = false;
    if (newStock > 0) updates.available = true;
    await base44.entities.Product.update(product.id, updates);
    load();
  };

  if (loading) return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-card rounded-2xl animate-pulse border border-border/30" />
      ))}
    </div>
  );

  if (products.length === 0) return (
    <div className="text-center py-16 text-muted-foreground">
      <PackageX className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm">Nenhum produto com stock ativado.</p>
      <p className="text-xs mt-1">Ativa o stock nos produtos no separador Menu.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {products.map((p) => (
        <div key={p.id} className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3">
          {p.image_url && (
            <img src={p.image_url} alt={p.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate text-sm">{p.name}</p>
            <p className="text-xs text-muted-foreground">{p.category}</p>
          </div>
          <div className={`text-xs font-medium px-2 py-1 rounded-full border ${
            p.stock === 0
              ? "bg-red-500/15 text-red-400 border-red-500/30"
              : p.stock <= 5
              ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
              : "bg-green-500/15 text-green-400 border-green-500/30"
          }`}>
            {p.stock === 0 ? "Esgotado" : `${p.stock} un.`}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => adjustStock(p, -1)}
              className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80"
            >
              <Minus className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <input
              type="number"
              value={p.stock || 0}
              onChange={(e) => setStock(p, e.target.value)}
              className="w-14 bg-secondary border border-border rounded-xl px-2 py-1.5 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              min="0"
            />
            <button
              onClick={() => adjustStock(p, 1)}
              className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center hover:bg-primary/90"
            >
              <Plus className="w-3.5 h-3.5 text-primary-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}