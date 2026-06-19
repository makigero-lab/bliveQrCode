# Arquitetura — bliveQrCode

## Visão geral

Aplicação **React + Vite** com backend em **Firebase Firestore**.
A persistência é multi-utilizador (todos os dispositivos partilham a
mesma base de dados Firebase) e a sincronização é em tempo real via
`onSnapshot`.

A autenticação está em modo demo (sempre admin) para permitir acesso
livre a `/admin` e `/staff` durante apresentações.

```
┌────────────────────────────────────────────────────────────┐
│                     Browser (cliente)                      │
│                                                            │
│   React (App.jsx)                                          │
│     │                                                      │
│     ├── AuthContext (bypass: user admin fixo)              │
│     ├── BarSettingsContext (doc "bar" da col "settings")   │
│     │     └─ onSnapshot em tempo real                      │
│     ├── QueryClientProvider (React Query)                  │
│     └── Routes                                             │
│           ├── /        → Menu.jsx                          │
│           ├── /menu    → Menu.jsx                          │
│           ├── /admin   → RequireAuth → Admin.jsx           │
│           └── /staff   → RequireAuth → Staff.jsx           │
│                                                            │
│   src/lib/db.js (camada de acesso a dados)                 │
│     ├─ products: listProducts, listAvailableProducts,      │
│     │            createProduct, updateProduct,             │
│     │            deleteProduct, subscribeProducts          │
│     ├─ orders:   listOrders, createOrder, updateOrder,     │
│     │            deleteOrder, subscribeOrders              │
│     ├─ settings: getBarSettings, saveBarSettings,          │
│     │            subscribeBarSettings                      │
│     └─ uploadFile (data URL base64)                        │
│                                                            │
│   src/lib/firebase.js (init)                               │
│     └─ export const db = getFirestore(app)                 │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌──────────────────────────────┐
            │  Firebase Firestore          │
            │  projectId: autocell-535c2   │
            │                              │
            │  Coleções:                   │
            │   - products (docs)          │
            │   - orders   (docs)          │
            │   - settings (1 doc, id bar) │
            └──────────────────────────────┘
```

## Camadas

### 1. Entry point

`src/main.jsx` monta o React na div `#root` do `index.html`.

### 2. App + Providers

`src/App.jsx` envolve a app em:

1. `AuthProvider` — bypass de auth (user admin fixo).
2. `QueryClientProvider` — React Query (com retry = 1 e
   `refetchOnWindowFocus: false`).
3. `BarSettingsProvider` — carrega o documento `bar` da coleção
   `settings` via Firestore e subscreve alterações em tempo real
   (`onSnapshot`). Aplica a cor primária dinamicamente via CSS vars.
4. `Router` (BrowserRouter) — define as rotas.

### 3. Páginas

- **`Menu.jsx`** — Lista produtos disponíveis (query
  `where available == true`), agrupados por categoria. Carrinho
  lateral com drawer, envio de pedido para a coleção `orders`.
- **`Admin.jsx`** — Painel de gestão com 7 separadores: Pedidos,
  Menu, Stock, Analytics, Vendas, QR, Config. Subscreve
  `orders` em tempo real via `subscribeOrders`.
- **`Staff.jsx`** — Vista de_staff: pedidos ativos agrupados por
  mesa, som de notificação via Web Audio API quando chega um pedido
  novo. Subscreve `orders` em tempo real via `subscribeOrders`.

### 4. Inicialização do Firebase

`src/lib/firebase.js` inicializa o Firebase App com o
`firebaseConfig` embutido (projectId `autocell-535c2`) e exporta
`db = getFirestore(app)`. Todos os outros módulos importam `db`
a partir daqui.

### 5. Camada de dados (`src/lib/db.js`)

Centraliza todas as operações Firestore para que os componentes
não importem diretamente `firebase/firestore`. Mantém compatibilidade
com a interface antiga (Base44) no que toca a eventos de subscrição:
`subscribeOrders(callback)` emite `{type, id, data}` em vez do
formato bruto do Firestore.

### 6. Sincronização em tempo real

- `Staff.jsx` e `Admin.jsx` usam `subscribeOrders(callback)` para
  receber pedidos novos no instante em que são criados.
- A query interna é `query(collection(db,"orders"), orderBy("created_date","desc"))`.
- O som de notificação (`useOrderNotification`) toca apenas quando
  chega um pedido **novo** (id não conhecido), não em updates.
- `BarSettingsContext` usa `subscribeBarSettings` para que qualquer
  alteração à cor primária ou nome do bar se reflita em todos os
  clientes instantaneamente.

## Fluxo de pedidos

```
Cliente (/menu?mesa=3)
  │
  │  1. Adiciona produtos ao carrinho (estado local do Menu.jsx)
  │  2. Abre CartDrawer, escreve observações
  │  3. Clica "Enviar pedido"
  │
  ▼
CartDrawer.handleSendOrder()
  │
  │  createOrder({
  │    table_number: "3",
  │    items: [...],
  │    total_amount: 17.50,
  │    status: "pendente",
  │    notes: "sem gelo"
  │  })
  │    └─ addDoc(collection(db,"orders"), payload)
  │
  ▼
Firestore grava o documento
  │
  │  onSnapshot dispara em todos os clientes subscritos
  │
  ▼
Staff.jsx (subscrito) recebe o evento "create"
  │
  │  setOrders(prev => [event.data, ...prev])
  │  setNewOrderAlert(true)
  │  if (soundEnabled) playSound()  ← Web Audio API beep
  │
  ▼
Staff usa TableGroup.handleAdvance(order) para mudar estado:
   pendente → confirmado → em_preparacao → pronto
   (cada update é updateDoc(doc(db,"orders",id), {status: next}))
```

## Rotas protegidas

`/admin` e `/staff` estão envolvidos por `<RequireAuth>`. Em modo
demo, o `RequireAuth` passa direto para o `children` porque o
`AuthContext` já tem `isAuthenticated: true` desde o início. Quando
se quiser reintroduzir auth real (Firebase Auth), basta:

1. Ativar Firebase Auth no projeto Firebase.
2. Reescrever `AuthContext` para usar `onAuthStateChanged`.
3. Atualizar `RequireAuth` para redirecionar se não autenticado.
4. Atualizar as regras de segurança do Firestore.

## Deploy na Vercel

- O `vercel.json` na raiz força todas as rotas para `/index.html`,
  permitindo que o React Router resolva o lado cliente.
- O comando de build é `npm run build` (Vite), com output em `dist/`.
- Não é necessário configurar variáveis de ambiente (a config do
  Firebase está embutida em `src/lib/firebase.js`).
- As regras de segurança do Firestore devem permitir leitura e
  escrita (pelo menos para a demo). Em produção, restringir a admins.
