import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  logLevel: "error",
  plugins: [
    // Plugin da Base44 removido — a app usa agora um cliente Mock
    // (src/api/base44Client.js) que persiste em localStorage.
    react(),
  ],
  resolve: {
    alias: {
      // O alias `@/` aponta para `src/`. Originalmente era configurado
      // automaticamente pelo `@base44/vite-plugin`; como removemos essa
      // dependência, configuramos explicitamente aqui.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
