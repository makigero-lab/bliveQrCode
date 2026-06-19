// src/lib/csv.js
// -------------------------------------------------------------
// Utilitários de exportação para CSV (Comma-Separated Values).
//
// Usado pelos painéis SalesDashboard e AnalyticsPanel para
// exportar relatórios de vendas abertos em Excel/Google Sheets.
// -------------------------------------------------------------

/**
 * Escapa um valor para CSV: envolve em aspas duplas e duplica as
 * aspas existentes, conforme RFC 4180.
 * @param {any} value
 * @returns {string}
 */
function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Se contém vírgula, aspa, nova linha ou início com espaço → envolve em aspas
  if (/[",\n\r]/.test(s) || /^\s/.test(s) || /\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Converte um array de objetos para CSV.
 * @param {Array<Object>} rows — linhas de dados
 * @param {Array<{key: string, label: string, format?: (v, row) => string}>} columns — definição de colunas
 * @returns {string} — texto CSV (com header + linhas, separados por \n)
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key];
        const formatted = c.format ? c.format(v, row) : v;
        return escapeCsv(formatted);
      })
      .join(",")
  );
  return [header, ...lines].join("\n");
}

/**
 * Força o download de um texto CSV como ficheiro no browser.
 * @param {string} csvContent — conteúdo CSV gerado por `toCsv`
 * @param {string} filename — nome do ficheiro (ex: "relatorio-vendas.csv")
 */
export function downloadCsv(csvContent, filename) {
  // Adiciona BOM (Byte Order Mark) para Excel reconhecer UTF-8
  // (necessário para acentos portugueses: ç, ã, é, etc.)
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Limpa o object URL após um pequeno delay para garantir o download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Helper: formata timestamp ISO para string legível "YYYY-MM-DD HH:MM".
 * @param {string} iso
 * @returns {string}
 */
export function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return String(iso);
  }
}

/**
 * Helper: resume os itens de um pedido numa string compacta.
 * Ex: "2× Caipirinha; 1× Mojito"
 * @param {Array} items
 * @returns {string}
 */
export function summarizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items
    .map((i) => `${i.quantity}× ${i.product_name}`)
    .join("; ");
}

/**
 * Gera um nome de ficheiro CSV com timestamp atual.
 * @param {string} prefix — ex: "relatorio-vendas"
 * @returns {string} — ex: "relatorio-vendas-2026-06-20.csv"
 */
export function csvFilename(prefix) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${prefix}-${date}.csv`;
}
