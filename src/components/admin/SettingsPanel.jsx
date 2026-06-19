import { useState, useRef } from "react";
import { Upload, Palette, Type, Image, Save, CheckCircle2 } from "lucide-react";
import { useBarSettings } from "@/lib/BarSettingsContext";
import { uploadFile } from "@/lib/db";

const PRESET_COLORS = [
  { label: "B'Live", value: "#E91E8C" },
  { label: "Rosa", value: "#EC4899" },
  { label: "Roxo", value: "#8B5CF6" },
  { label: "Azul", value: "#3B82F6" },
  { label: "Ciano", value: "#06B6D4" },
  { label: "Verde", value: "#10B981" },
  { label: "Dourado", value: "#F59E0B" },
  { label: "Laranja", value: "#F97316" },
  { label: "Vermelho", value: "#EF4444" },
  { label: "Branco", value: "#F8F8F8" },
];

export default function SettingsPanel() {
  const { settings, updateSettings } = useBarSettings();
  const [form, setForm] = useState({
    bar_name: settings.bar_name || "Bar Nobre",
    primary_color: settings.primary_color || "#E91E8C",
    logo_url: settings.logo_url || "",
    tagline: settings.tagline || "",
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef();

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await uploadFile({ file });
      set("logo_url", file_url);
    } catch (err) {
      console.error("[SettingsPanel] Erro no upload do logótipo:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Bar Name */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-base">Nome do estabelecimento</h3>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Nome do bar</label>
          <input
            type="text"
            value={form.bar_name}
            onChange={(e) => set("bar_name", e.target.value)}
            placeholder="Ex: Bar Nobre"
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Tagline (opcional)</label>
          <input
            type="text"
            value={form.tagline}
            onChange={(e) => set("tagline", e.target.value)}
            placeholder="Ex: O melhor bar da cidade"
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Logo */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Image className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-base">Logótipo</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border border-border bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
            ) : (
              <Image className="w-8 h-8 text-muted-foreground/30" />
            )}
          </div>
          <div className="flex-1">
            <button
              onClick={() => fileRef.current.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "A carregar..." : "Fazer upload do logótipo"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            {form.logo_url && (
              <button
                onClick={() => set("logo_url", "")}
                className="text-xs text-destructive mt-2 hover:underline"
              >
                Remover logótipo
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Color */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-base">Cor principal</h3>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => set("primary_color", c.value)}
              title={c.label}
              className="flex flex-col items-center gap-1 group"
            >
              <div
                className={`w-full aspect-square rounded-xl border-2 transition-all ${
                  form.primary_color === c.value ? "border-foreground scale-105" : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              />
              <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
                {c.label}
              </span>
            </button>
          ))}
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Cor personalizada</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
              className="w-10 h-10 rounded-xl border border-border cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={form.primary_color}
              onChange={(e) => set("primary_color", e.target.value)}
              className="flex-1 bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />
            <div
              className="w-10 h-10 rounded-xl border border-border flex-shrink-0"
              style={{ backgroundColor: form.primary_color }}
            />
          </div>
        </div>
      </div>



      {/* Preview */}
      <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-base text-muted-foreground text-sm">Pré-visualização</h3>
        <div className="rounded-xl overflow-hidden border border-border/50">
          <div className="px-4 pt-6 pb-4" style={{ background: `${form.primary_color}15` }}>
            <div className="flex items-center gap-2 mb-1">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-5 h-5 object-contain rounded" />
              ) : (
                <div className="w-5 h-5 rounded-full" style={{ backgroundColor: form.primary_color }} />
              )}
              <span className="text-xs font-medium tracking-widest uppercase" style={{ color: form.primary_color }}>
                {form.bar_name || "Bar Nobre"}
              </span>
            </div>
            <p className="font-playfair font-bold text-2xl text-foreground">Menu</p>
            {form.tagline && <p className="text-muted-foreground text-xs mt-0.5">{form.tagline}</p>}
          </div>
          <div className="px-4 py-3 bg-secondary/50 flex gap-2">
            <div
              className="px-3 py-1.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: form.primary_color }}
            >
              ✨ Todos
            </div>
            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-secondary text-muted-foreground">🍺 Bebidas</div>
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-colors shadow-lg disabled:opacity-50"
        style={{
          backgroundColor: saved ? "#10B981" : form.primary_color,
          color: "#fff",
        }}
      >
        {saved ? (
          <><CheckCircle2 className="w-5 h-5" /> Guardado!</>
        ) : saving ? (
          "A guardar..."
        ) : (
          <><Save className="w-5 h-5" /> Guardar alterações</>
        )}
      </button>
    </div>
  );
}