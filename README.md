# bliveQrCode

Aplicação web para **menu digital com QR code** dirigida a bares e
restaurantes. O cliente abre a página `/menu?mesa=N`, escolhe os
produtos e envia o pedido; o staff acompanha em tempo real na página
`/staff` e a gestão completa é feita em `/admin`.

> ℹ️ **Arquitetura atual**: a app foi migrada de **Base44** para
> **Firebase Firestore**. A persistência é multi-utilizador (todos os
> dispositivos partilham a mesma base de dados Firebase) e a
> sincronização é em tempo real via `onSnapshot`. A autenticação foi
> desativada (modo demo) para permitir acesso livre a `/admin` e
> `/staff`. Ver secção [Arquitetura](#arquitetura).

## Requisitos

- Node.js 18 ou superior
- npm 9 ou superior

## Instalação

```bash
git clone https://github.com/makigero-lab/bliveQrCode.git
cd bliveQrCode
npm install
```

## Variáveis de ambiente

Não são necessárias. A configuração do Firebase está embutida em
`src/lib/firebase.js` (projectId: `autocell-535c2`).

> ⚠️ **Pré-requisito**: a base de dados Firestore tem de existir no
> projeto Firebase antes de executarmos a app ou o script de seed.
> Se ainda não foi criada, ir a
> <https://console.firebase.google.com/project/autocell-535c2/firestore>
> e clicar em **Create database** (modo produção ou teste).

> ⚠️ **Regras de segurança do Firestore**: para a demo funcionar, as
> regras do Firestore devem permitir leitura e escrita públicas nas
> coleções `products`, `orders` e `settings`. Em produção, convém
> restringir a escrita a utilizadores autenticados com role admin.

## Popular a base de dados com a carta do B'Live

O repositório inclui o catálogo completo extraído das 3 cartas oficiais
do B'Live Lounge Bar (PDFs publicados em `bliveloungebar.com`):
carta principal (cocktails, bebidas espirituosas, vinhos, etc.),
carta de shishas e carta de comida.

Para popular a coleção `products` no Firestore:

```bash
npm install
node scripts/seed-products.js            # adiciona produtos novos
# ou, para apagar tudo e recomeçar:
node scripts/seed-products.js --reset
```

O script é **idempotente**: não duplica produtos com o mesmo `slug`.
Total: **150 produtos** prontos a usar.

Quando tiveres fotografias profissionais dos produtos, substitui o
campo `image_url` (atualmente com placeholders da Unsplash) por URLs
das fotos reais — podes editar produto a produto no painel Admin, ou
alterar diretamente o ficheiro `scripts/catalog.js` e voltar a
correr o seed com `--reset`.

## Scripts

| Script             | Descrição                                |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Arranca o Vite em modo desenvolvimento.  |
| `npm run build`    | Compila para `dist/` para produção.      |
| `npm run preview`  | Pré-visualiza o build de produção.       |
| `npm run lint`     | Corre o ESLint sem mostrar avisos.       |
| `npm run lint:fix` | Corre o ESLint e corrige automaticamente.|

## Estrutura de rotas

| Rota      | Acesso   | Descrição                                          |
| --------- | -------- | -------------------------------------------------- |
| `/`       | Público  | Menu digital (atalho para `/menu`).                |
| `/menu`   | Público  | Menu digital com carrinho e envio de pedido.       |
| `/staff`  | Livre*   | Vista de_staff (pedidos por mesa, som de notificação, **tempo real**). |
| `/admin`  | Livre*   | Painel de gestão: pedidos, menu, stock, analytics, vendas, QR, configurações. |

\* Em modo demo não há autenticação. Ver `src/lib/AuthContext.jsx`.

## Arquitetura

### Camadas

```
src/
├── lib/
│   ├── firebase.js         ← Inicializa Firebase App + Firestore (db)
│   ├── db.js               ← Camada de acesso a dados (CRUD + onSnapshot)
│   ├── AuthContext.jsx     ← Auth bypass para demo (sempre admin)
│   ├── BarSettingsContext.jsx ← Documento único "bar" na coleção settings
│   ├── app-params.js       ← Legacy (não usado)
│   ├── PageNotFound.jsx    ← Página 404
│   ├── query-client.js     ← React Query client
│   └── utils.js            ← Helpers (cn, etc.)
├── components/
│   ├── admin/              ← Componentes do painel de gestão
│   ├── menu/               ← Componentes do menu digital
│   └── ui/                 ← Componentes shadcn/ui
├── hooks/
│   └── useOrderNotification.js  ← Som de notificação (Web Audio API)
├── pages/
│   ├── Admin.jsx           ← onSnapshot(orders) + onSnapshot(products via reload)
│   ├── Menu.jsx            ← getDocs(products where available==true)
│   └── Staff.jsx           ← onSnapshot(orders ordered by created_date desc)
├── App.jsx                 ← Rotas + providers
├── main.jsx                ← Entry point
└── index.css               ← Estilos globais (Tailwind)
```

### Firestore — coleções

| Coleção    | Tipo       | Notas                                                  |
| ---------- | ---------- | ------------------------------------------------------ |
| `products` | documentos | Um doc por produto. Campos: `name`, `description`, `price`, `category`, `image_url`, `available`, `stock_enabled`, `stock`, `created_date`, `updated_date`. |
| `orders`   | documentos | Um doc por pedido. Campos: `table_number`, `items[]`, `total_amount`, `tip_amount`, `status`, `payment_method`, `notes`, `created_date`, `updated_date`. |
| `settings` | 1 documento | Doc com id `bar`. Campos: `bar_name`, `primary_color`, `logo_url`, `tagline`, `payment_methods`. |

### Camada de dados (`src/lib/db.js`)

Todos os componentes consomem este módulo. Funções exportadas:

- `listProducts()` — `getDocs(collection products)` ordenado por `created_date` desc.
- `listAvailableProducts()` — `getDocs(query products where available==true)`.
- `createProduct(data)`, `updateProduct(id, patch)`, `deleteProduct(id)`.
- `subscribeProducts(callback)` — `onSnapshot(collection products)`.
- `listOrders(limit)` — `getDocs(query orders orderBy created_date desc)`.
- `createOrder(data)`, `updateOrder(id, patch)`, `deleteOrder(id)`.
- `subscribeOrders(callback)` — `onSnapshot(query orders orderBy created_date desc)`. Emite eventos `{type: "snapshot"|"create"|"update"|"delete", id?, data?}` para compatibilidade com os componentes que vieram da Base44.
- `getBarSettings()`, `saveBarSettings(data)`, `subscribeBarSettings(callback)`.
- `uploadFile({file})` — lê ficheiro como data URL base64 (sem Firebase Storage).

### Sincronização em tempo real

- `Staff.jsx` e `Admin.jsx` usam `subscribeOrders(callback)` para receber
  pedidos novos no instante em que são criados. A query está ordenada
  por `created_date desc` para que os mais recentes apareçam no topo.
- O som de notificação (`useOrderNotification`) toca apenas quando
  chega um pedido **novo** (id não conhecido), não em updates.
- `BarSettingsContext` usa `subscribeBarSettings` para que qualquer
  alteração à cor primária ou nome do bar se reflita em todos os
  clientes instantaneamente.

### Vercel

O ficheiro [`vercel.json`](./vercel.json) na raiz contém:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Isto garante que qualquer rota client-side (`/menu`, `/staff`,
`/admin`, etc.) é servida pelo `index.html`, evitando o erro 404 na
Vercel quando o utilizador faz refresh ou acede diretamente a uma
rota.

## Documentação interna

- [`WORKLOG.md`](./WORKLOG.md) — Registo cronológico das intervenções
  no repositório.
- [`docs/ARQUITETURA.md`](./docs/ARQUITETURA.md) — Visão técnica
  detalhada das camadas e fluxos.
- [`docs/REGRAS.md`](./docs/REGRAS.md) — Regras de negócio e
  convenções do projeto.

## Próximos passos sugeridos

- **Reativar autenticação** com Firebase Auth (email/password ou
  Google) e restringir `/admin` e `/staff` a utilizadores com role
  `admin`. As regras de segurança do Firestore devem ser atualizadas
  em paralelo.
- **Mover uploads para Firebase Storage** em vez de data URLs base64
  (que incham os documentos Firestore).
- **Adicionar índices compostos** no Firestore se aparecerem avisos
  de query sem índice (ex.: filtrar por `available` + ordenar por
  `created_date`).
