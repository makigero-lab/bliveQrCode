import { createContext, useContext, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

const BarSettingsContext = createContext(null);

export function BarSettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    bar_name: "B'Live Lounge Bar",
    primary_color: "#E91E8C",
    logo_url: null,
    tagline: null,
  });

  const loadSettings = async () => {
    const data = await base44.entities.BarSettings.list();
    if (data.length > 0) {
      setSettings(data[0]);
      applyColor(data[0].primary_color);
    }
  };

  const applyColor = (hex) => {
    if (!hex) return;
    const hsl = hexToHsl(hex);
    document.documentElement.style.setProperty("--primary", hsl);
    // Keep primary-foreground readable
    const lightness = parseFloat(hsl.split(" ")[2]);
    document.documentElement.style.setProperty(
      "--primary-foreground",
      lightness > 50 ? "0 0% 9%" : "0 0% 98%"
    );
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSettings = async (newSettings) => {
    if (settings.id) {
      const updated = await base44.entities.BarSettings.update(settings.id, newSettings);
      setSettings(updated);
      applyColor(updated.primary_color);
    } else {
      const created = await base44.entities.BarSettings.create(newSettings);
      setSettings(created);
      applyColor(created.primary_color);
    }
  };

  return (
    <BarSettingsContext.Provider value={{ settings, updateSettings, loadSettings }}>
      {children}
    </BarSettingsContext.Provider>
  );
}

export function useBarSettings() {
  return useContext(BarSettingsContext);
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