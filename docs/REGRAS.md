# Regras de Negócio e Convenções — bliveQrCode

## 1. Categorias de produtos

O sistema reconhece **5 categorias** de produtos (definidas em
`CategoryTabs.jsx` e em `ProductForm.jsx`):

| ID           | Label       | Emoji |
| ------------ | ----------- | ----- |
| `bebidas`    | Bebidas     | 🍺    |
| `cocktails`  | Cocktails   | 🍹    |
| `comida`     | Comida      | 🍔    |
| `sobremesas` | Sobremesas  | 🍮    |
| `shisha`     | Shisha      | 💨    |

> ⚠️ O separador "Todos" (`todos`) é uma categoria virtual usada só
> no filtro do menu; não é uma categoria de produto.

## 2. Estados de pedidos

Os pedidos atravessam 4 estados sequenciais (definidos em
`OrderCard.jsx` e `TableGroup.jsx`):

```
pendente → confirmado → em_preparacao → pronto
```

| Estado          | Label      | Cor (Tailwind)         | Próximo estado     |
| --------------- | ---------- | ---------------------- | ------------------ |
| `pendente`      | Pendente   | yellow-500             | `confirmado`       |
| `confirmado`    | Confirmado | blue-500               | `em_preparacao`    |
| `em_preparacao` | Em prep.   | orange-500             | `pronto`           |
| `pronto`        | Pronto     | green-500              | —                  |

Estado adicional usado pelo painel de Analytics:
- `pago` — usado internamente para filtrar pedidos concluídos nos
  relatórios de vendas e analytics. Não aparece no fluxo de cartões
  de_staff.

Estado de limpeza:
- `pronto_limpo` — usado em `Staff.jsx` para excluir pedidos da vista
  "Mesas ativas". Atualmente nenhum fluxo atribui este estado
  automaticamente; é reservado para uso futuro.

## 3. Stock

- Cada produto tem um campo `stock_enabled` (booleano) que ativa o
  controlo de stock.
- Quando `stock_enabled = true`, o campo `stock` (número) é
  decrementado automaticamente quando um pedido passa de `pendente`
  para `confirmado` (ver `OrderCard.handleAdvance` e
  `TableGroup.handleAdvance`).
- Se o stock chegar a `0`, o produto é automaticamente marcado como
  `available = false` (indisponível no menu).
- O painel de Stock permite ajustar manualmente o stock com botões
  `+` / `-` e edição direta do número.

## 4. Carrinho e envio de pedido

- O carrinho vive no estado local do `Menu.jsx` (objeto
  `{ [productId]: quantity }`).
- Não há persistência entre reloads — o carrinho perde-se se o
  utilizador fecha o separador.
- Ao confirmar o pedido, é criado um `Order` com:
  - `table_number` (lido da query string `?mesa=N`, defeito `"1"`)
  - `items` (array de `{ product_id, product_name, quantity,
    unit_price, total }`)
  - `total_amount` (soma dos totais dos items)
  - `tip_amount` (0 por defeito via CartDrawer; PaymentModal permite
    gorjeta)
  - `status: "pendente"`
  - `notes` (opcional)

## 5. Notificações sonoras (Staff)

- O hook `useOrderNotification` gera dois beeps ascendentes (880 Hz +
  1100 Hz) via Web Audio API.
- O som toca apenas quando chega um pedido **novo** (evento
  `create`).
- Pode ser silenciado pelo botão sino no canto superior direito do
  `Staff.jsx`.
- Browsers podem bloquear o AudioContext sem interação prévia do
  utilizador — o erro é capturado silenciosamente.

## 6. Configuração do bar

Definida na entidade `BarSettings` (Mock Client):

| Campo             | Tipo    | Descrição                                   |
| ----------------- | ------- | ------------------------------------------- |
| `bar_name`        | string  | Nome exibido no header de todas as páginas. |
| `primary_color`   | hex     | Cor primária (aplicada dinamicamente via CSS vars). |
| `logo_url`        | string? | URL ou data URL do logótipo.                |
| `tagline`         | string? | Subtítulo exibido sob o nome do bar.        |
| `payment_methods` | array?  | Lista de métodos de pagamento ativos.       |

Métodos de pagamento suportados (definidos em `PaymentModal.jsx`):
`mbway`, `multibanco`, `cartao`, `numerario`.

## 7. QR Codes

- O separador QR do painel de Admin gera URLs na forma
  `{baseUrl}?mesa={N}` onde `baseUrl` é derivado da origem atual.
- Cada QR pode ser descarregado como PNG (300×300) ou copiado para a
  área de transferência.
- Por defeito são criadas 10 mesas; é possível adicionar mais com o
  botão "Adicionar mesa".

## 8. Convenções de código

- **Linguagem**: JavaScript (JSX) — não TypeScript, exceto nos
  componentes `ui/*` que são .jsx/.tsx mistos.
- **Estilo**: Tailwind CSS com classes utilitárias; variáveis CSS
  (`--primary`, `--background`, etc.) definidas em `tailwind.config.js`
  e `index.css`.
- **Aliases**: `@/` mapeia para `src/` (definido em `jsconfig.json` e
  `vite.config.js`).
- **Componentes UI**: baseados em shadcn/ui (Radix UI + Tailwind).
- **Estado servidor**: React Query (`@tanstack/react-query`) está
  disponível mas pouco usado — a maior parte do estado vive nos
  componentes e no Mock Client.
- **Idioma da UI**: Português europeu (PT-PT). Textos como "A enviar",
  "Adicionar", "Mesa", "Pronto", etc.

## 9. Acessos

| Rota      | Auth necessária | Notas                                       |
| --------- | --------------- | ------------------------------------------- |
| `/`       | Não             | Redireciona internamente para o Menu.       |
| `/menu`   | Não             | Página pública acedida via QR code.         |
| `/staff`  | Sim (Mock)      | Em modo Mock, qualquer visitante passa.     |
| `/admin`  | Sim (Mock)      | Em modo Mock, qualquer visitante passa.     |

> ⚠️ Em modo Mock **não há proteção real**. Quando se ligar a um
> backend, o `RequireAuth` deve ser atualizado para verificar a
> sessão/scope do utilizador.

## 10. Mock Data — gerir dados

Para limpar todos os dados Mock e voltar à semente inicial, abrir a
consola do browser e executar:

```js
Object.keys(localStorage)
  .filter((k) => k.startsWith("blive_"))
  .forEach((k) => localStorage.removeItem(k));
location.reload();
```

Para inspecionar os dados atuais:

```js
console.table(JSON.parse(localStorage.getItem("blive_Product")));
console.table(JSON.parse(localStorage.getItem("blive_Order")));
console.log(JSON.parse(localStorage.getItem("blive_BarSettings")));
```
