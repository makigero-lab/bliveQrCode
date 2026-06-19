import { createContext, useContext, useEffect, useState } from "react";
import { getBarSettings, saveBarSettings, subscribeBarSettings } from "@/lib/db";

/**
 * BarSettingsContext (Firestore)
 * -----------------------------------------------------------------
 * Lê e atualiza um documento único (id "bar") na coleção `settings`
 * do Firestore. Também subscreve alterações em tempo real via
 * `onSnapshot`, pelo que a cor primária e o nome do bar se atualizam
 * em todos os clientes instantaneamente quando o admin guarda.
 * -----------------------------------------------------------------
 */
const BarSettingsContext = createContext(null);

const DEFAULT_SETTINGS = {
  id: "bar",
  bar_name: "B'Live Lounge Bar",
  primary_color: "#E91E8C",
  logo_url: null,
  tagline: null,
  payment_methods: ["mbway", "multibanco", "cartao", "numerario"],
};

export function BarSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    // Carga inicial com getBarSettings (uma só vez) — garante que o
    // documento é criado com defaults se ainda não existir.
    getBarSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        applyColor(data.primary_color);
      })
      .catch((err) => {
        console.error("[BarSettings] Falha ao carregar configuração:", err);
      });

    // Subscrição em tempo real — atualiza sempre que o documento muda
    const unsubscribe = subscribeBarSettings((next) => {
      if (cancelled) return;
      setSettings(next);
      applyColor(next.primary_color);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const updateSettings = async (newSettings) => {
    try {
      const saved = await saveBarSettings(newSettings);
      setSettings(saved);
      applyColor(saved.primary_color);
      return saved;
    } catch (err) {
      console.error("[BarSettings] Falha ao guardar configuração:", err);
      throw err;
    }
  };

  return (
    <BarSettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </BarSettingsContext.Provider>
  );
}

export function useBarSettings() {
  return useContext(BarSettingsContext);
}

function applyColor(hex) {
  if (!hex) return;
  const hsl = hexToHsl(hex);
  document.documentElement.style.setProperty("--primary", hsl);
  // Keep primary-foreground readable
  const lightness = parseFloat(hsl.split(" ")[2]);
  document.documentElement.style.setProperty(
    "--primary-foreground",
    lightness > 50 ? "0 0% 9%" : "0 0% 98%"
  );
}

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
