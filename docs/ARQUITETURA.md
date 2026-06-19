# Arquitetura — bliveQrCode

## Visão geral

Aplicação **frontend-only** (sem backend) que implementa um menu
digital com QR code para bares e restaurantes. Foi originalmente
gerada sobre a plataforma **Base44**, mas essa dependência foi
removida na totalidade. Atualmente os dados são Mock, persistidos em
`localStorage` no browser de cada cliente.

```
┌────────────────────────────────────────────────────────────┐
│                     Browser (cliente)                      │
│                                                            │
│   React (App.jsx)                                          │
│     │                                                      │
│     ├── AuthContext (Mock: user admin local)               │
│     ├── BarSettingsContext (carrega settings do Mock)      │
│     ├── QueryClientProvider (React Query)                  │
│     └── Routes                                             │
│           ├── /        → Menu.jsx                          │
│           ├── /menu    → Menu.jsx                          │
│           ├── /admin   → RequireAuth → Admin.jsx           │
│           └── /staff   → RequireAuth → Staff.jsx           │
│                                                            │
│   src/api/base44Client.js (Mock Client)                    │
│     ├─ entities.Product / Order / BarSettings              │
│     │    ├─ list / filter / create / update / delete       │
│     │    └─ subscribe (pub/sub interno)                    │
│     ├─ auth.me / logout / redirectToLogin (no-ops)         │
│     └─ integrations.Core.UploadFile (data URL base64)      │
│                                                            │
│   localStorage (prefixo "blive_")                          │
│     ├─ blive_Product      (lista de produtos)              │
│     ├─ blive_Order        (lista de pedidos)               │
│     ├─ blive_BarSettings  (configuração do bar)            │
│     └─ blive_seeded_v1    (flag de seed inicial)           │
└────────────────────────────────────────────────────────────┘
```

## Camadas

### 1. Entry point

`src/main.jsx` monta o React na div `#root` do `index.html`.

### 2. App + Providers

`src/App.jsx` envolve a app em:

1. `AuthProvider` — disponibiliza o user Mock + estado de auth.
2. `QueryClientProvider` — React Query (com retry = 1 e
   `refetchOnWindowFocus: false`).
3. `BarSettingsProvider` — carrega as configurações do bar a partir
   do Mock Client e aplica a cor primária dinamicamente.
4. `Router` (BrowserRouter) — define as rotas.

### 3. Páginas

- **`Menu.jsx`** — Lista produtos disponíveis, agrupados por
  categoria. Carrinho lateral com drawer, envio de pedido para o Mock
  Client.
- **`Admin.jsx`** — Painel de gestão com 7 separadores: Pedidos,
  Menu, Stock, Analytics, Vendas, QR, Config.
- **`Staff.jsx`** — Vista de_staff: pedidos ativos agrupados por
  mesa, som de notificação via Web Audio API.

### 4. Mock Client

`src/api/base44Client.js` é o coração da nova arquitetura. Mantém a
mesma interface pública do `@base44/sdk` para não obrigar a reescrita
de componentes:

| Método                          | Comportamento Mock                              |
| ------------------------------- | ----------------------------------------------- |
| `entities.X.list(sort, limit)`  | Lê array do localStorage, ordena, limita.       |
| `entities.X.filter(criteria)`   | Filtra por AND simples (+ operadores `$eq`,...). |
| `entities.X.create(data)`       | Gera id e created_date, guarda, notifica subs.  |
| `entities.X.update(id, patch)`  | Merge raso, atualiza `updated_date`, notifica.  |
| `entities.X.delete(id)`         | Remove do array, notifica.                      |
| `entities.X.subscribe(cb)`      | Regista callback, devolve função de unsubscribe.|
| `auth.me()`                     | Devolve Mock user (admin local).                |
| `auth.logout()` / `redirectToLogin()` | No-ops.                                   |
| `integrations.Core.UploadFile({file})` | Lê o ficheiro como data URL base64.        |

### 5. Pub/Sub interno (substitui WebSocket)

Cada entidade mantém um array de subscribers em memória. Quando
`create` / `update` / `delete` é chamado, todos os subscribers são
notificados com `{ type, id, data }` — exatamente o formato esperado
pelos componentes `Admin.jsx` e `Staff.jsx`.

### 6. Dados semente

Na primeira carga, se `localStorage.blive_seeded_v1` não existir, são
inseridos:

- **6 produtos** cobrindo as 4 categorias (`bebidas`, `cocktails`,
  `comida`, `sobremesas`) + `shisha`.
- **3 pedidos** com estados diferentes (`pendente`, `confirmado`,
  `em_preparacao`) para a página de Staff carregar com conteúdo.
- **1 configuração de bar** com nome `B'Live Lounge Bar`, cor
  `#E91E8C` e tagline.

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
  │  base44.entities.Order.create({
  │    table_number: "3",
  │    items: [...],
  │    total_amount: 17.50,
  │    status: "pendente",
  │    notes: "sem gelo"
  │  })
  │
  ▼
Mock Client grava em localStorage.blive_Order
  │
  │  notify("Order", { type: "create", id, data })
  │
  ▼
Staff.jsx (subscrito) recebe o evento
  │
  │  setOrders(prev => [event.data, ...prev])
  │  setNewOrderAlert(true)
  │  if (soundEnabled) playSound()  ← Web Audio API beep
  │
  ▼
Staff usa TableGroup.handleAdvance(order) para mudar estado:
   pendente → confirmado → em_preparacao → pronto
```

## Rotas protegidas

`/admin` e `/staff` estão envolvidos por `<RequireAuth>`. Em modo
Mock, o `RequireAuth` mostra um loading de 60 ms e deixa passar — não
há login real. Quando se ligar a um backend, este componente é o ponto
natural para reintroduzir a verificação de sessão.

## Deploy na Vercel

- O `vercel.json` na raiz força todas as rotas para `/index.html`,
  permitindo que o React Router resolva o lado cliente.
- O comando de build é `npm run build` (Vite), com output em `dist/`.
- Não é necessário configurar variáveis de ambiente (a app é Mock).
