// =============================================================
// bliveQrCode — Mock Data Client
// -------------------------------------------------------------
// Este módulo substitui completamente o cliente `@base44/sdk`
// original. Mantém a MESMA interface pública usada em todo o
// código da aplicação (`base44.entities.X.list/filter/create/
// update/delete/subscribe`, `base44.auth.me/logout/redirectTo-
// Login`, `base44.integrations.Core.UploadFile`) para que todos
// os componentes continuem a funcionar sem alterações.
//
// Dados são persistidos em `localStorage` (prefixo `blive_`) e
// existe um mecanismo de pub/sub interno que substitui as
// subscrições WebSocket da Base44.
//
// Em produção (Vercel) este cliente elimina o erro
// `t.filter is not a function` causado pelas chamadas WebSocket
// da Base44 quando o backend não estava disponível.
// =============================================================

const STORAGE_PREFIX = "blive_";
const SEED_FLAG = `${STORAGE_PREFIX}seeded_v1`;

// -------------------------------------------------------------
// Semente de dados iniciais (Mock Data)
// -------------------------------------------------------------
const SEED_PRODUCTS = [
  {
    id: "prod-1",
    name: "Coca-Cola Lata",
    description: "Lata 33cl servida bem fresca",
    price: 2.5,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400&q=80",
    available: true,
    stock_enabled: true,
    stock: 24,
    created_date: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "prod-2",
    name: "Super Bock",
    description: "Cerveja 20cl de pressão",
    price: 1.8,
    category: "bebidas",
    image_url:
      "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=400&q=80",
    available: true,
    stock_enabled: true,
    stock: 36,
    created_date: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: "prod-3",
    name: "Mojito",
    description: "Rum, hortelã, lima, açúcar e soda",
    price: 7.5,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1551538827-9c037cb4f32a?w=400&q=80",
    available: true,
    stock_enabled: false,
    stock: 0,
    created_date: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "prod-4",
    name: "Gin Tónica",
    description: "Gin, água tónica, limão e bagas",
    price: 8.0,
    category: "cocktails",
    image_url:
      "https://images.unsplash.com/photo-1614475281245-5b96b50c4c69?w=400&q=80",
    available: true,
    stock_enabled: false,
    stock: 0,
    created_date: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: "prod-5",
    name: "Hambúrguer Clássico",
    description: "Carne 150g, queijo, alface, tomate e batatas",
    price: 9.9,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
    available: true,
    stock_enabled: true,
    stock: 12,
    created_date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "prod-6",
    name: "Tábua de Queijos",
    description: "Seleção de queijos nacionais com compota e pão",
    price: 12.0,
    category: "comida",
    image_url:
      "https://images.unsplash.com/photo-1452195100486-9cc805987862?w=400&q=80",
    available: true,
    stock_enabled: false,
    stock: 0,
    created_date: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "prod-7",
    name: "Cheesecake",
    description: "Fatia de cheesecake com molho de frutos vermelhos",
    price: 4.5,
    category: "sobremesas",
    image_url:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&q=80",
    available: true,
    stock_enabled: false,
    stock: 0,
    created_date: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: "prod-8",
    name: "Shisha Especial da Casa",
    description: "Sessão de shisha com carvão natural",
    price: 15.0,
    category: "shisha",
    image_url:
      "https://images.unsplash.com/photo-1604948501466-4e9c339b9c24?w=400&q=80",
    available: true,
    stock_enabled: false,
    stock: 0,
    created_date: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
];

const SEED_BAR_SETTINGS = {
  id: "bar-1",
  bar_name: "B'Live Lounge Bar",
  primary_color: "#E91E8C",
  logo_url: null,
  tagline: "O melhor da noite, ao seu lado",
  payment_methods: ["mbway", "multibanco", "cartao", "numerario"],
};

const SEED_ORDERS = [
  {
    id: "order-1",
    table_number: "1",
    items: [
      {
        product_id: "prod-3",
        product_name: "Mojito",
        quantity: 2,
        unit_price: 7.5,
        total: 15.0,
      },
      {
        product_id: "prod-1",
        product_name: "Coca-Cola Lata",
        quantity: 1,
        unit_price: 2.5,
        total: 2.5,
      },
    ],
    total_amount: 17.5,
    tip_amount: 0,
    status: "pendente",
    notes: "Sem gelo no mojito",
    payment_method: "cartao",
    created_date: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: "order-2",
    table_number: "3",
    items: [
      {
        product_id: "prod-5",
        product_name: "Hambúrguer Clássico",
        quantity: 2,
        unit_price: 9.9,
        total: 19.8,
      },
    ],
    total_amount: 19.8,
    tip_amount: 1.0,
    status: "em_preparacao",
    notes: "",
    payment_method: "mbway",
    created_date: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "order-3",
    table_number: "1",
    items: [
      {
        product_id: "prod-4",
        product_name: "Gin Tónica",
        quantity: 1,
        unit_price: 8.0,
        total: 8.0,
      },
    ],
    total_amount: 8.0,
    tip_amount: 0,
    status: "confirmado",
    notes: "",
    payment_method: "numerario",
    created_date: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
  },
];

// -------------------------------------------------------------
// Utilitários internos
// -------------------------------------------------------------
function genId(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function readCollection(name) {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${name}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn(`[mock] Falha ao ler coleção ${name}:`, e);
    return null;
  }
}

function writeCollection(name, data) {
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${name}`,
      JSON.stringify(data)
    );
  } catch (e) {
    console.warn(`[mock] Falha ao escrever coleção ${name}:`, e);
  }
}

// Pub/Sub interno (substitui WebSocket)
const subscribers = {
  Product: [],
  Order: [],
  BarSettings: [],
};

function notify(entityName, event) {
  (subscribers[entityName] || []).forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.warn(`[mock] Subscriptor de ${entityName} lançou erro:`, e);
    }
  });
}

// Comparador que suporta a sintaxe `"-created_date"` usada no código
// original (Base44 aceitava string com prefixo `-` para descendente).
function makeComparator(sort) {
  if (!sort) return null;
  const descending = typeof sort === "string" && sort.startsWith("-");
  const field = typeof sort === "string" ? sort.replace(/^-/, "") : sort;
  return (a, b) => {
    const av = a[field];
    const bv = b[field];
    if (av == null && bv == null) return 0;
    if (av == null) return descending ? 1 : -1;
    if (bv == null) return descending ? -1 : 1;
    if (av < bv) return descending ? 1 : -1;
    if (av > bv) return descending ? -1 : 1;
    return 0;
  };
}

// Aplica um filtro simples AND sobre objeto de critérios
function applyFilter(items, criteria) {
  if (!criteria || typeof criteria !== "object") return items;
  return items.filter((item) =>
    Object.entries(criteria).every(([key, value]) => {
      if (value === undefined || value === null) return true;
      // suporte a filtros parciais: se value for objeto com operadores
      if (typeof value === "object" && !Array.isArray(value)) {
        return Object.entries(value).every(([op, opValue]) => {
          switch (op) {
            case "$eq":
              return item[key] === opValue;
            case "$ne":
              return item[key] !== opValue;
            case "$gt":
              return item[key] > opValue;
            case "$gte":
              return item[key] >= opValue;
            case "$lt":
              return item[key] < opValue;
            case "$lte":
              return item[key] <= opValue;
            case "$in":
              return Array.isArray(opValue) && opValue.includes(item[key]);
            default:
              return true;
          }
        });
      }
      return item[key] === value;
    })
  );
}

// -------------------------------------------------------------
// Factory de entidades Mock
// -------------------------------------------------------------
function createEntity(name, seed) {
  // Semente garantida na primeira carga
  if (!window.localStorage.getItem(SEED_FLAG)) {
    writeCollection("Product", SEED_PRODUCTS);
    writeCollection("Order", SEED_ORDERS);
    writeCollection("BarSettings", [SEED_BAR_SETTINGS]);
    window.localStorage.setItem(SEED_FLAG, "1");
  }
  // Se a coleção ainda não existir (ex.: reset manual), semeia de novo
  if (readCollection(name) === null) {
    writeCollection(name, seed);
  }

  return {
    /**
     * Lista registos.
     * @param {string} [sort]   Campo de ordenação (prefixo `-` para descendente).
     * @param {number} [limit]  Limite de resultados.
     * @returns {Promise<Array>}
     */
    async list(sort, limit) {
      let items = readCollection(name) || [];
      const cmp = makeComparator(sort);
      if (cmp) items = [...items].sort(cmp);
      if (typeof limit === "number" && limit > 0) items = items.slice(0, limit);
      // devolve clones para evitar mutações acidentais
      return items.map((i) => ({ ...i }));
    },

    /**
     * Filtra registos por critérios simples (AND).
     * @param {object} criteria
     * @returns {Promise<Array>}
     */
    async filter(criteria) {
      const items = readCollection(name) || [];
      return applyFilter(items, criteria).map((i) => ({ ...i }));
    },

    /**
     * Cria um novo registo. Gera id e created_date automaticamente.
     */
    async create(data) {
      const items = readCollection(name) || [];
      const now = new Date().toISOString();
      const record = {
        ...data,
        id: data.id || genId(name.toLowerCase()),
        created_date: data.created_date || now,
        updated_date: now,
      };
      items.push(record);
      writeCollection(name, items);
      notify(name, { type: "create", id: record.id, data: { ...record } });
      return { ...record };
    },

    /**
     * Atualiza um registo por id (merge raso).
     */
    async update(id, patch) {
      const items = readCollection(name) || [];
      const idx = items.findIndex((i) => i.id === id);
      if (idx === -1) {
        throw { status: 404, message: `${name} ${id} não encontrado` };
      }
      const updated = {
        ...items[idx],
        ...patch,
        id: items[idx].id,
        updated_date: new Date().toISOString(),
      };
      items[idx] = updated;
      writeCollection(name, items);
      notify(name, { type: "update", id, data: { ...updated } });
      return { ...updated };
    },

    /**
     * Apaga um registo por id.
     */
    async delete(id) {
      const items = readCollection(name) || [];
      const next = items.filter((i) => i.id !== id);
      writeCollection(name, next);
      notify(name, { type: "delete", id });
      return { id };
    },

    /**
     * Subscreve eventos da entidade (create/update/delete).
     * Substitui o WebSocket da Base44. Devolve função de cancelamento.
     */
    subscribe(callback) {
      if (typeof callback !== "function") return () => {};
      subscribers[name].push(callback);
      return () => {
        subscribers[name] = subscribers[name].filter((cb) => cb !== callback);
      };
    },
  };
}

// -------------------------------------------------------------
// Mock de Auth — utilizador admin local fictício
// -------------------------------------------------------------
const MOCK_USER = {
  id: "mock-user-1",
  name: "Utilizador Local",
  email: "admin@blive.local",
  role: "admin",
};

const auth = {
  async me() {
    // simula latência mínima para o loading state funcionar
    await new Promise((r) => setTimeout(r, 50));
    return { ...MOCK_USER };
  },
  logout(_redirectUrl) {
    // Em modo Mock não há logout real; apenas regista no console.
    console.info("[mock] logout chamado (no-op em modo Mock).");
  },
  redirectToLogin(_returnToUrl) {
    // Em modo Mock não há login externo; o utilizador fica autenticado.
    console.info("[mock] redirectToLogin chamado (no-op em modo Mock).");
  },
};

// -------------------------------------------------------------
// Mock de integrations.Core.UploadFile
// Devolve um data URL (base64) que pode ser usado diretamente em <img>
// -------------------------------------------------------------
const integrations = {
  Core: {
    async UploadFile({ file }) {
      if (!file) {
        throw { message: "Nenhum ficheiro fornecido a UploadFile." };
      }
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return { file_url: dataUrl, file_name: file.name };
    },
  },
};

// -------------------------------------------------------------
// Cliente Mock exportado — mesma forma que o `createClient` da Base44
// -------------------------------------------------------------
export const base44 = {
  entities: {
    Product: createEntity("Product", SEED_PRODUCTS),
    Order: createEntity("Order", SEED_ORDERS),
    BarSettings: createEntity("BarSettings", [SEED_BAR_SETTINGS]),
  },
  auth,
  integrations,
};

export default base44;
