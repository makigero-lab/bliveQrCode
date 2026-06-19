# bliveQrCode

Aplicação web para **menu digital com QR code** dirigida a bares e
restaurantes. O cliente abre a página `/menu?m=<id>` (lê o QR code da
mesa), escolhe os produtos e envia o pedido; o staff acompanha em
tempo real na página `/staff` (Contas por Mesa / Open Tabs) e a gestão
completa é feita em `/admin`.

> ℹ️ **Arquitetura atual**: Firebase Firestore + Firebase Auth
> (Email/Password). Persistência multi-utilizador com sincronização em
> tempo real via `onSnapshot`. Autenticação real com roles (`admin` /
> `staff`) guardadas na coleção `users`.

## Requisitos

- Node.js 18 ou superior
- npm 9 ou superior
- Conta no Firebase (já configurada: projeto `autocell-535c2`)

## Instalação

```bash
git clone https://github.com/makigero-lab/bliveQrCode.git
cd bliveQrCode
npm install
```

## Variáveis de ambiente

Não são necessárias. A configuração do Firebase está embutida em
`src/lib/firebase.js` (projectId: `autocell-535c2`).

---

## 🚀 Setup completo (passo a passo)

> Lê esta secção toda antes de começar. Demora ~10 minutos.

### Passo 1 — Criar a base de dados Firestore

As coleções **não existem automaticamente**. Precisas de criar a
base de dados Firestore no projeto Firebase primeiro:

1. Abrir <https://console.firebase.google.com/project/autocell-535c2/firestore>.
2. Clicar em **"Create database"**.
3. Escolher modo **"Test"** (regras abertas por 30 dias — bom para
   começar) ou **"Production"** (regras restritas — terás de as
   configurar manualmente conforme o Passo 4).
4. Região: `europe-west1` (recomendado para Portugal).

### Passo 2 — Ativar Email/Password no Firebase Auth

1. Abrir <https://console.firebase.google.com/project/autocell-535c2/authentication/sign-in-method>.
2. Clicar em **Email/Password**.
3. Ativar a primeira toggle (**Email/Password**) → **Save**.

### Passo 3 — Correr o script de bootstrap (cria tudo)

No terminal, dentro da pasta do projeto:

```bash
node scripts/bootstrap.js
```

O script vai:

1. **Testar ligação ao Firestore** (se falhar, lê a mensagem de erro).
2. **Criar `settings/bar`** com configuração padrão do B'Live
   (nome, cor, tagline).
3. **Pedir-te email + password** para criar o primeiro admin (conta
   Firebase Auth + perfil em `users/` com `role: "admin"`).
4. **Criar 10 mesas** na coleção `tables` com IDs seguros de 8 chars.
5. **Popular `products`** com os 150 produtos do catálogo B'Live.

Em alternativa, podes passar as credenciais via variáveis de ambiente
(útil para automação):

```bash
ADMIN_EMAIL=admin@blive.pt ADMIN_PASSWORD=senha123 node scripts/bootstrap.js
```

> 💡 O script é **idempotente**: podes corrê-lo várias vezes sem
> duplicar dados.

### Passo 4 — Configurar regras de segurança (recomendado)

Por defeito, a base de dados está em modo "Test" (tudo aberto). Para
produção, aplica estas regras em
<https://console.firebase.google.com/project/autocell-535c2/firestore/rules>:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Mesas: leitura pública (para /menu validar ?m=), escrita só admin
    match /tables/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    // Users: leitura do próprio + admin; escrita só admin
    match /users/{uid} {
      allow read: if request.auth != null &&
        (request.auth.uid == uid ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin");
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    // Products: leitura pública; escrita só admin
    match /products/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
    // Orders: leitura auth; create público (clientes enviam); update/delete auth
    match /orders/{id} {
      allow read: if request.auth != null;
      allow create: if true;
      allow update, delete: if request.auth != null;
    }
    // Settings: leitura pública; escrita só admin
    match /settings/{id} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
    }
  }
}
```

### Passo 5 — Correr a app localmente

```bash
npm run dev
```

Abrir <http://localhost:5173> → redireciona para `/login` → faz login
com as credenciais do admin criado no Passo 3.

### Passo 6 — Deploy na Vercel

1. Push do código para GitHub (já feito pelo assistente).
2. Em <https://vercel.com>, importar o repositório.
3. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`.
4. Deploy. A app fica disponível em `https://blive-qr-code.vercel.app`
   (ou semelhante).

---

## 🆘 Troubleshooting

### "Mesa Inválida" no `/menu`

- Verifica que o URL tem `?m=<id>` (não `?mesa=N` — esse formato é
  legacy).
- Verifica que a mesa existe na coleção `tables` em
  <https://console.firebase.google.com/project/autocell-535c2/firestore/data/~2Ftables>.
- Gera novos QR codes em `/admin → QR → Adicionar mesa`.

### "auth/configuration-not-found" no login

- Email/Password não está ativado. Volta ao Passo 2.

### "permission-denied" ao ler produtos

- Regras de segurança do Firestore estão restritas. Aplica as regras
  do Passo 4 (ou usa modo "Test" temporariamente).

### Pedidos não aparecem no `/staff`

- Abre o DevTools (F12) → Console. Procura por `[Staff][open]`.
- Se não houver eventos, é problema de regras do Firestore em `orders`.
  Clients não autenticados precisam de permissão de `create`.

### Esqueci-me da password do admin

- Em <https://console.firebase.google.com/project/autocell-535c2/authentication/users>,
  clica no user → "Reset password" → envia email de reset.

---

## Popular a base de dados com a carta do B'Live

Já feito pelo script `bootstrap.js` (Passo 3 acima). Se quiseres
repovoar só a coleção `products` (sem mexer nas mesas/admin):

```bash
node scripts/seed-products.js            # adiciona produtos novos
node scripts/seed-products.js --reset    # apaga tudo e recriia
```

Quando tiveres fotografias profissionais dos produtos, substitui o
campo `image_url` (atualmente com placeholders da Unsplash) por URLs
das fotos reais — podes editar produto a produto no painel Admin
(separador Menu → Editor visual), ou alterar diretamente o ficheiro
`src/data/catalog.js` e voltar a correr o bootstrap.

## Setup via UI (alternativa ao CLI)

Se preferires não usar o terminal, podes fazer o setup inicial pelo
painel Admin:

1. Cria o primeiro admin manualmente em
   <https://console.firebase.google.com/project/autocell-535c2/authentication/users>
   (Add user).
2. Copia o `uid` gerado.
3. Em
   <https://console.firebase.google.com/project/autocell-535c2/firestore/data>,
   cria manualmente a coleção `users` com um documento:
   - **Document ID**: o `uid` do passo 2
   - **Fields**: `email` (string), `role` (string = "admin"),
     `created_date` (string = `2026-06-20T00:00:00.000Z`)
4. Faz login na app com esse admin.
5. Vai a `/admin → Sistema` e clica em **"Criar coleções em falta"**.
   O botão verifica o estado de cada coleção e cria `settings`,
   `tables` (10 mesas) e `products` (150 produtos) conforme necessário.

> ⚠️ O botão "Sistema" **não** cria utilizadores (porque criar user
> afeta a sessão atual do Firebase Auth). Para criar mais admins/staff
> depois do primeiro, usa o separador **Utilizadores** no painel Admin.

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
