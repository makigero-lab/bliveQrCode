// src/components/admin/QRCodesTab.jsx
// -------------------------------------------------------------
// Geração de QR Codes SEGUROS por Mesa.
//
// Cada mesa tem um documento na coleção `tables` com:
//   - id: hash aleatório de 8 chars (gerado por generateTableId)
//   - table_number: número amigável (ex: "3")
//
// O QR code aponta para `/menu?m=<id>` em vez de `/menu?mesa=3`.
// O /menu valida o ID na coleção tables; se não existir, bloqueia
// com "Mesa Inválida". Isto impede falsificação do número da mesa
// via manipulação do URL.
//
// Funcionalidades:
//   - Listar todas as mesas (subscribeTables — tempo real).
//   - Adicionar mesa: pede o número → createTable → gera QR.
//   - Apagar mesa: deleteTable (o QR deixa de funcionar).
//   - Download PNG + copiar link para cada QR.
// -------------------------------------------------------------

import { useRef, useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Download,
  Copy,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  createTable,
  deleteTable,
  subscribeTables,
} from "@/lib/db";

function QRCard({ mesa, mid, url, onDelete }) {
  const svgRef = useRef();
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const svg = svgRef.current.querySelector("svg");
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      URL.revokeObjectURL(svgUrl);
      const a = document.createElement("a");
      a.download = `mesa-${mesa}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = svgUrl;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 flex flex-col items-center gap-3 relative">
      <button
        onClick={onDelete}
        title="Apagar mesa (o QR deixa de funcionar)"
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5 text-destructive" />
      </button>
      <p className="font-playfair font-semibold text-lg">Mesa {mesa}</p>
      <div ref={svgRef} className="bg-white p-3 rounded-xl">
        <QRCodeSVG value={url} size={150} />
      </div>
      <p className="text-muted-foreground text-[10px] break-all text-center font-mono">
        {url}
      </p>
      <p className="text-[10px] text-muted-foreground/60 -mt-1">
        ID: <code className="text-primary">{mid}</code>
      </p>
      <div className="flex gap-2 w-full">
        <button
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center gap-1.5 bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium py-2 rounded-xl transition-colors"
        >
          {copied ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Copiado!
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copiar
            </>
          )}
        </button>
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </button>
      </div>
    </div>
  );
}

export default function QRCodesTab({ baseUrl }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newMesa, setNewMesa] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Subscrição em tempo real à coleção tables
  useEffect(() => {
    const unsubscribe = subscribeTables((items) => {
      setTables(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    const num = String(newMesa || "").trim();
    if (!num) {
      setError("Indica o número da mesa.");
      return;
    }
    // Verifica duplicado
    if (tables.some((t) => String(t.table_number) === num)) {
      setError(`Já existe uma Mesa ${num}.`);
      return;
    }

    setCreating(true);
    setError("");
    try {
      await createTable(num);
      console.info(`[QRCodesTab] Mesa ${num} criada.`);
      setNewMesa("");
      setShowAdd(false);
    } catch (err) {
      console.error("[QRCodesTab] Erro ao criar mesa:", err);
      setError(`Erro ao criar mesa: ${err?.message || ""}`);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (mid, mesaNum) => {
    const confirm = window.confirm(
      `Apagar a Mesa ${mesaNum}?\n\n` +
        `O QR code correspondente deixa de funcionar imediatamente. ` +
        `Pedidos já enviados dessa mesa NÃO são afetados.\n\n` +
        `Confirmar?`
    );
    if (!confirm) return;

    try {
      await deleteTable(mid);
      console.info(`[QRCodesTab] Mesa ${mesaNum} (id=${mid}) apagada.`);
    } catch (err) {
      console.error("[QRCodesTab] Erro ao apagar mesa:", err);
      alert(`Erro ao apagar: ${err?.message || ""}`);
    }
  };

  // baseUrl aponta para /menu; vamos usar ?m=<id>
  // Garantir que termina em /menu (sem trailing slash duplo)
  const menuBaseUrl = baseUrl.endsWith("/menu") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/menu`;

  if (loading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">A carregar mesas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-lg">QR Codes por Mesa</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Cada QR usa um ID seguro ({`?m=xxxxxxxx`}).
            Clientes não podem falsificar o número da mesa.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Adicionar mesa
        </button>
      </div>

      {/* Formulário de adicionar */}
      {showAdd && (
        <div className="bg-card border border-primary/30 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm">Nova mesa</h3>
          <input
            type="text"
            value={newMesa}
            onChange={(e) => setNewMesa(e.target.value)}
            placeholder="Número da mesa (ex: 3, ou 'terraço 1')"
            autoFocus
            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setShowAdd(false);
                setNewMesa("");
                setError("");
              }
            }}
          />
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAdd(false);
                setNewMesa("");
                setError("");
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={creating}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              Criar mesa
            </button>
          </div>
        </div>
      )}

      {/* Lista de QR codes */}
      {tables.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border/50 rounded-2xl">
          <p className="text-sm">Nenhuma mesa criada.</p>
          <p className="text-xs mt-1 opacity-70">
            Clica em "Adicionar mesa" para gerar o primeiro QR code.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {tables.map((table) => {
            const url = `${menuBaseUrl}?m=${table.id}`;
            return (
              <QRCard
                key={table.id}
                mesa={table.table_number}
                mid={table.id}
                url={url}
                onDelete={() => handleDelete(table.id, table.table_number)}
              />
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-xs text-muted-foreground">
        <p className="font-medium text-primary mb-1">ℹ️ Como funcionam os QR codes</p>
        <p>
          Cada QR aponta para <code className="text-primary font-mono">/menu?m=XXXXXXXX</code> onde{" "}
          <code className="text-primary font-mono">XXXXXXXX</code> é um ID aleatório de 8 caracteres.
          O <code className="text-primary font-mono">/menu</code> valida este ID na coleção{" "}
          <code className="text-primary font-mono">tables</code> do Firestore — se o ID não existir,
          a app bloqueia com "Mesa Inválida". Isto impede que clientes adulterem o número da mesa
          no URL.
        </p>
        <p className="mt-2">
          Se apagares uma mesa, o QR deixa de funcionar imediatamente (ideal para resolver
          problemas de mesas roubadas ou danificadas).
        </p>
      </div>
    </div>
  );
}
