import { useState } from "react";
import { X } from "lucide-react";
import { createProduct, updateProduct } from "@/lib/db";

const categories = ["bebidas", "cocktails", "comida", "sobremesas", "shisha"];

export default function ProductForm({ product, onClose, onSaved }) {
  const [form, setForm] = useState(product || {
    name: "", description: "", price: "", category: "bebidas",
    image_url: "", available: true, stock_enabled: false, stock: 0
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const data = { ...form, price: parseFloat(form.price) || 0 };
      if (product?.id) {
        await updateProduct(product.id, data);
      } else {
        await createProduct(data);
      }
    } catch (err) {
      console.error("[ProductForm] Erro ao guardar produto:", err);
    } finally {
      setLoading(false);
      onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-card rounded-3xl w-full max-w-md p-6 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-playfair font-semibold text-xl">
            {product ? "Editar produto" : "Novo produto"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {[
          { label: "Nome", key: "name", type: "text" },
          { label: "Descrição", key: "description", type: "text" },
          { label: "Preço (€)", key: "price", type: "number" },
          { label: "Imagem URL", key: "image_url", type: "text" },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        ))}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
          <select
            value={form.category}
            onChange={(e) => set("category", e.target.value)}
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => set("available", !form.available)}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.available ? "bg-primary" : "bg-secondary"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.available ? "left-5" : "left-1"}`} />
          </div>
          <span className="text-sm text-foreground">Disponível</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => set("stock_enabled", !form.stock_enabled)}
            className={`w-10 h-6 rounded-full transition-colors relative ${form.stock_enabled ? "bg-primary" : "bg-secondary"}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form.stock_enabled ? "left-5" : "left-1"}`} />
          </div>
          <span className="text-sm text-foreground">Controlo de stock</span>
        </label>

        {form.stock_enabled && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Quantidade em stock</label>
            <input
              type="number"
              value={form.stock}
              onChange={(e) => set("stock", parseInt(e.target.value) || 0)}
              min="0"
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading || !form.name}
          className="w-full bg-primary text-primary-foreground py-3 rounded-2xl font-semibold text-sm disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {loading ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
