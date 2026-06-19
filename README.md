# bliveQrCode

Aplicação web para **menu digital com QR code** dirigida a bares e
restaurantes. O cliente abre a página `/menu?mesa=N`, escolhe os
produtos e envia o pedido; o staff acompanha em tempo real na página
`/staff` e a gestão completa é feita em `/admin`.

> ⚠️ **Nota importante sobre a arquitetura**: a app foi originalmente
> gerada sobre a plataforma **Base44** (SDK + plugin Vite + WebSocket).
> Essa dependência foi **removida na totalidade** por causar o erro
> `t.filter is not a function` em produção (Vercel). Atualmente a app
> usa **Mock Data** persistido em `localStorage` — funciona sem
> qualquer backend. Ver secção [Arquitetura](#arquitetura).

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

A partir da remoção da Base44 **já não é necessário nenhum ficheiro
`.env`**. A app funciona apenas com o `npm install` + `npm run dev`.

Caso queira sobrepor o ID da app (apenas para compatibilidade de
código antigo), pode definir:

```
VITE_BASE44_APP_ID=blive-mock-app
```

mas isso é opcional e não tem efeito prático na nova arquitetura.

## Scripts

| Script            | Descrição                                |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Arranca o Vite em modo desenvolvimento.  |
| `npm run build`   | Compila para `dist/` para produção.      |
| `npm run preview` | Pré-visualiza o build de produção.       |
| `npm run lint`    | Corre o ESLint sem mostrar avisos.       |
| `npm run lint:fix`| Corre o ESLint e corrige automaticamente.|

## Estrutura de rotas

| Rota      | Acesso   | Descrição                                          |
| --------- | -------- | -------------------------------------------------- |
| `/`       | Público  | Menu digital (atalho para `/menu`).                |
| `/menu`   | Público  | Menu digital com carrinho e envio de pedido.       |
| `/staff`  | Protegido| Vista de_staff (pedidos por mesa, som de notificação). |
| `/admin`  | Protegido| Painel de gestão: pedidos, menu, stock, analytics, vendas, QR, configurações. |

## Arquitetura

### Camadas

```
src/
├── api/
│   └── base44Client.js     ← Mock client (localStorage + pub/sub)
├── components/
│   ├── admin/              ← Componentes do painel de gestão
│   ├── menu/               ← Componentes do menu digital
│   └── ui/                 ← Componentes shadcn/ui
├── hooks/
│   └── useOrderNotification.js  ← Som de notificação (Web Audio API)
├── lib/
│   ├── app-params.js       ← Parâmetros da app (Mock, sem Base44)
│   ├── AuthContext.jsx     ← Contexto de autenticação (Mock)
│   ├── BarSettingsContext.jsx ← Configurações do bar (Mock)
│   ├── PageNotFound.jsx    ← Página 404
│   └── query-client.js     ← React Query client
├── pages/
│   ├── Admin.jsx
│   ├── Menu.jsx
│   └── Staff.jsx
├── App.jsx                 ← Rotas + providers
├── main.jsx                ← Entry point
└── index.css               ← Estilos globais (Tailwind)
```

### Mock Data (`src/api/base44Client.js`)

Este módulo substitui completamente o cliente `@base44/sdk` e mantém a
mesma interface pública para não obrigar a reescrita de componentes:

- `base44.entities.Product` — `list()`, `filter()`, `create()`,
  `update()`, `delete()`, `subscribe()`.
- `base44.entities.Order` — mesma API; `subscribe()` substitui o
  WebSocket original.
- `base44.entities.BarSettings` — mesma API.
- `base44.auth.me()`, `base44.auth.logout()`,
  `base44.auth.redirectToLogin()` — no-ops em modo Mock.
- `base44.integrations.Core.UploadFile()` — devolve um data URL base64
  que pode ser usado diretamente em `<img src=...>`.

Os dados são persistidos em `localStorage` com o prefixo `blive_`
(`blive_Product`, `blive_Order`, `blive_BarSettings`). Na primeira
carga são inseridos dados semente (6 produtos, 3 pedidos, 1
configuração de bar) para a app arrancar com conteúdo visível.

Para limpar todos os dados Mock e voltar à semente inicial, abra a
consola do browser e execute:

```js
Object.keys(localStorage)
  .filter((k) => k.startsWith("blive_"))
  .forEach((k) => localStorage.removeItem(k));
location.reload();
```

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

A arquitetura atual é **frontend-only**. Quando se quiser ter
persistência multi-utilizador (vários dispositivos a ver os mesmos
pedidos), será necessário ligar a um backend. Sugestões:

1. **Supabase** — oferece PostgreSQL + Realtime, substituindo com
   poucas alterações o Mock Client.
2. **Firebase Firestore** — alternativa NoSQL com real-time.
3. **API REST própria** — máxima flexibilidade, exige mais trabalho.

Em qualquer dos casos, basta reescrever o ficheiro
`src/api/base44Client.js` mantendo a mesma interface pública.
