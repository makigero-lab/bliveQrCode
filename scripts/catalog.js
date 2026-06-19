// scripts/catalog.js
// -------------------------------------------------------------
// Re-export do catálogo partilhado em `src/data/catalog.js`.
// O catálogo foi movido para `src/data/catalog.js` para poder ser
// importado tanto pelo frontend (botão "Importar Catálogo" no
// Admin.jsx) como por este script Node.
//
// Esta indireção mantém a compatibilidade com `scripts/seed-products.js`
// que faz `import { PRODUCTS } from "./catalog.js"`.
// -------------------------------------------------------------

// O Vite/Node resolve ambos os formatos. Usamos caminho relativo para
// o ficheiro partilhado em src/data/.
export { PRODUCTS, CATALOG_SUMMARY, CATALOG_TOTAL, CATEGORIES, normalizeProduct } from "../src/data/catalog.js";

console.log(
  `[catalog] Script de seed usa src/data/catalog.js (150 produtos).`
);
