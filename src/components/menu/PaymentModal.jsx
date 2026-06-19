import { motion, AnimatePresence } from "framer-motion";
import { X, CreditCard, Smartphone, Hash, Banknote, CheckCircle2, Heart } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useBarSettings } from "@/lib/BarSettingsContext";

const ALL_METHODS = [
  { id: "mbway", label: "MB WAY", icon: Smartphone },
  { id: "multibanco", label: "Multibanco", icon: Hash },
  { id: "cartao", label: "Cartão", icon: CreditCard },
  { id: "numerario", label: "Numerário", icon: Banknote },
];

const TIP_PERCENTS = [0, 5, 10, 15];

export default function PaymentModal({ items, total, tableNumber, onClose, onOrderPlaced }) {
  const { settings } = useBarSettings();
  const methods = ALL_METHODS.filter((m) =>
    !settings.payment_methods || settings.payment_methods.includes(m.id)
  );
  const [step, setStep] = useState("tip"); // "tip" | "payment"
  const [tipType, setTipType] = useState("percent"); // "percent" | "fixed"
  const [tipPercent, setTipPercent] = useState(0);
  const [tipFixed, setTipFixed] = useState("");
  const [method, setMethod] = useState(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const tipAmount =
    tipType === "percent"
      ? (total * tipPercent) / 100
      : Math.max(0, parseFloat(tipFixed) || 0);

  const grandTotal = total + tipAmount;

  const handleConfirm = async () => {
    if (!method) return;
    setLoading(true);
    await base44.entities.Order.create({
      table_number: tableNumber,
      items: items.map((i) => ({
        product_id: i.id,
        product_name: i.name,
        quantity: i.quantity,
        unit_price: i.price,
        total: i.total,
      })),
      total_amount: grandTotal,
      tip_amount: tipAmount,
      status: "pendente",
      payment_method: method,
      notes: notes || undefined,
    });
    setLoading(false);
    setSuccess(true);
    setTimeout(() => onOrderPlaced(), 2500);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={!success ? onClose : undefined}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 bg-card rounded-3xl p-6 border border-border max-w-md mx-auto"
      >
        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
              <CheckCircle2 className="w-16 h-16 text-primary" />
            </motion.div>
            <h2 className="font-playfair font-bold text-2xl">Pedido enviado!</h2>
            <p className="text-muted-foreground text-sm">
              O teu pedido foi recebido. Podes pagar na mesa ou ao balcão com {methods.find((m) => m.id === method)?.label}.
            </p>
          </div>
        ) : step === "tip" ? (
          <>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-playfair font-semibold text-xl flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" /> Gorjeta
              </h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Tipo de gorjeta */}
            <div className="flex gap-2 mb-4">
              {["percent", "fixed"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTipType(t)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                    tipType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t === "percent" ? "Percentagem" : "Valor fixo"}
                </button>
              ))}
            </div>

            {tipType === "percent" ? (
              <div className="grid grid-cols-4 gap-2 mb-5">
                {TIP_PERCENTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setTipPercent(p)}
                    className={`py-3 rounded-2xl text-sm font-semibold transition-all border-2 ${
                      tipPercent === p
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/50 text-foreground hover:border-primary/40"
                    }`}
                  >
                    {p === 0 ? "Sem\ngorjeta" : `${p}%`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-5">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
                  <input
                    type="number"
                    min="0"
                    step="0.50"
                    placeholder="0.00"
                    value={tipFixed}
                    onChange={(e) => setTipFixed(e.target.value)}
                    className="w-full bg-secondary border border-border rounded-xl pl-7 pr-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 5].map((v) => (
                    <button
                      key={v}
                      onClick={() => setTipFixed(String(v))}
                      className="flex-1 py-2 rounded-xl text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
                    >
                      +€{v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo */}
            <div className="bg-secondary/50 rounded-2xl p-4 mb-5 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>€{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Gorjeta</span>
                <span className={tipAmount > 0 ? "text-primary font-medium" : ""}>
                  {tipAmount > 0 ? `+€${tipAmount.toFixed(2)}` : "—"}
                </span>
              </div>
              <div className="flex justify-between font-playfair font-bold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary">€{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Observações */}
            <div className="mb-5">
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Observações (opcional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: sem gelo, alergia a frutos secos..."
                className="w-full bg-secondary border border-border rounded-xl p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            <button
              onClick={() => setStep("payment")}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Continuar
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep("tip")}
                  className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  ←
                </button>
                <h2 className="font-playfair font-semibold text-xl">Pagamento</h2>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {methods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                    method === m.id ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
                  }`}
                >
                  <m.icon className={`w-6 h-6 ${method === m.id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${method === m.id ? "text-primary" : "text-foreground"}`}>
                    {m.label}
                  </span>
                </button>
              ))}
            </div>

            <div className="bg-secondary/50 rounded-2xl p-4 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>€{total.toFixed(2)}</span>
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Gorjeta</span>
                  <span className="text-primary font-medium">+€{tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-playfair font-bold text-base pt-1 border-t border-border">
                <span>Total</span>
                <span className="text-primary">€{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!method || loading}
              className="w-full bg-primary text-primary-foreground py-4 rounded-2xl font-semibold text-base disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              {loading ? "A processar..." : "Confirmar pedido"}
            </button>
          </>
        )}
      </motion.div>
    </>
  );
}