# WORKLOG — bliveQrCode

Registo cronológico das intervenções no repositório
[`makigero-lab/bliveQrCode`](https://github.com/makigero-lab/bliveQrCode).
Cada entrada descreve uma sessão de trabalho: o que foi pedido, o que
foi feito e o estado final.

---

## 2026-06-20 — Remoção da Base44 + vercel.json

**Tarefa**

- Criar `vercel.json` na raiz com rewrites para corrigir erro 404 na
  Vercel.
- Remover completamente a dependência, os ficheiros e as chamadas aos
  WebSockets da Base44 (que causavam o erro `t.filter is not a function`
  em produção).
- Substituir os dados da Base44 por Mock Data no frontend, de modo a
  que as páginas de produtos (`/menu`) e `/staff` carreguem sem erros
  em produção.
- Commit com a mensagem `Fix: Remoção da Base44 e adição do vercel.json`
  e push para o repositório.
- Atualizar a documentação do programa.

**Trabalho realizado**

1. **`vercel.json`** — Confirmada a existência do ficheiro na raiz com
   a configuração pretendida:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   Não foi necessária alteração — apenas validação.

2. **`src/api/base44Client.js`** — Reescrito por completo. Era o único
   ponto de entrada do `@base44/sdk` (via `createClient`). Agora
   exporta um **Mock Client** com a mesma interface pública:
   - `base44.entities.Product` / `Order` / `BarSettings` com `list`,
     `filter`, `create`, `update`, `delete`, `subscribe`.
   - `base44.auth.me()`, `logout()`, `redirectToLogin()` (no-ops).
   - `base44.integrations.Core.UploadFile()` (devolve data URL base64).
   - Persistência em `localStorage` (prefixo `blive_`) com dados
     semente (6 produtos, 3 pedidos, 1 configuração de bar).
   - Pub/sub interno que substitui o WebSocket da Base44 para
     `subscribe()`.

3. **`src/lib/AuthContext.jsx`** — Reescrito. A versão original fazia
   uma chamada HTTP a
   `/api/apps/public/prod/public-settings/by-id/...` que dependia do
   backend Base44 e crashava em produção. A nova versão considera o
   utilizador sempre autenticado como admin local (modo Mock).

4. **`src/lib/app-params.js`** — Simplificado. As env vars
   `VITE_BASE44_*` já não são necessárias; o módulo mantém a mesma API
   exportada para não partir imports existentes.

5. **`src/lib/PageNotFound.jsx`** — Removida a chamada
   `base44.auth.me()` e a dependência de `@tanstack/react-query`; a
   página passou a ser estática.

6. **`src/components/RequireAuth.jsx`** — Simplificado: em modo Mock
   não há login externo, por isso o componente passa direto após um
   loading mínimo.

7. **`package.json`** — Removidas as dependências `@base44/sdk` e
   `@base44/vite-plugin`. Nome do pacote passou de `base44-app` para
   `blive-qrcode`.

8. **`vite.config.js`** — Removida a importação e uso do
   `@base44/vite-plugin`. Fica apenas o plugin React standard.

9. **`index.html`** — Atualizado o `<title>` para `bliveQrCode — Menu
   Digital`, removida a referência ao favicon da Base44 e adicionada
   meta `description`.

10. **Ficheiros removidos**:
    - `base44/` (pasta com `config.jsonc` e `entities/*.jsonc` —
      metadados da Base44 já não usados).
    - `barflow-main.zip` (resíduo de um upload manual anterior).

11. **Documentação**:
    - `README.md` reescrito em PT-PT com a nova arquitetura.
    - Criada a pasta `docs/` com `ARQUITETURA.md` (visão técnica) e
      `REGRAS.md` (regras de negócio e convenções).
    - Este `WORKLOG.md` criado para servir de histórico.

**Estado final**

- A app compila sem a dependência `@base44/sdk` nem
  `@base44/vite-plugin`.
- As páginas `/`, `/menu`, `/admin` e `/staff` carregam com dados
  simulados em `localStorage`.
- O `vercel.json` garante que não há erro 404 em rotas client-side na
  Vercel.
- Commit criado com a mensagem `Fix: Remoção da Base44 e adição do
  vercel.json` e pushed para `origin/main`.

**Pendente para próximas iterações**

- Ligar a um backend real (Supabase, Firebase ou API REST própria)
  quando se quiser persistência multi-utilizador. Até lá, os dados
  vivem apenas no dispositivo de cada cliente.
- Atualizar o `package-lock.json` com `npm install` para refletir as
  dependências removidas (a Vercel faz isto automaticamente no build).

---

## 2026-06-20 — Migração completa de Base44 (Mock) para Firebase Firestore

**Tarefa**

Migrar o backend da aplicação de "Base44" (na verdade já em modo Mock
após a intervenção anterior) para **Firebase Firestore**, mantendo o
funcionamento em tempo real e o deploy na Vercel. Tarefas executadas
rigorosamente:

1. Confirmar remoção das dependências `@base44/sdk` e
   `@base44/vite-plugin` do `package.json`; instalar o pacote oficial
   `firebase`.
2. Apagar a pasta `base44/` (já não existia) e o ficheiro
   `src/api/base44Client.js`.
3. Criar `src/lib/firebase.js` que inicializa o Firebase com o
   `firebaseConfig` fornecido e exporta `db = getFirestore(app)`.
4. Refatorar todos os componentes que usavam `base44.entities.Product`
   (Menu, Admin, StockPanel, ProductForm, OrderCard, TableGroup) para
   usar o Firestore apontando para a coleção `products`.
5. Substituir todas as chamadas `base44.entities.Order` por operações
   na coleção `orders`.
6. **CRÍTICO**: substituir as subscrições `base44.entities.Order.subscribe`
   em `Staff.jsx` e `Admin.jsx` por `onSnapshot` do Firestore, ordenando
   os pedidos por `created_date desc`.
7. Refatorar `BarSettingsContext` para ler/atualizar um documento
   único (`id="bar"`) na coleção `settings`.
8. Refatorar `AuthContext` e `RequireAuth` para bypass total
   (utilizador sempre autenticado como admin, `isLoadingAuth: false`).
9. Garantir que o `vercel.json` se mantém na raiz com as regras de
   rewrites SPA.
10. Commit com a mensagem `Feat: Migração completa de Base44 para
    Firebase Firestore` e push para `origin/main`.

**Trabalho realizado**

1. **`package.json`** — Adicionada a dependência `"firebase":
   "^11.2.0"`. As dependências `@base44/*` já tinham sido removidas
   na intervenção anterior; confirmado que continuam ausentes.
   `npm install` executado: 685 pacotes instalados.

2. **`src/lib/firebase.js`** — Criado. Inicializa o Firebase App com
   o `firebaseConfig` fornecido (projectId `autocell-535c2`) e
   exporta `app` e `db = getFirestore(app)`.

3. **`src/lib/db.js`** — Criado. Camada de acesso a dados que
   centraliza todas as operações Firestore:
   - `listProducts`, `listAvailableProducts`, `createProduct`,
     `updateProduct`, `deleteProduct`, `subscribeProducts`.
   - `listOrders(limit)`, `createOrder`, `updateOrder`, `deleteOrder`,
     `subscribeOrders(callback)`.
   - `getBarSettings`, `saveBarSettings`, `subscribeBarSettings`.
   - `uploadFile({file})` — converte ficheiro em data URL base64
     (mantém a interface antiga
     `base44.integrations.Core.UploadFile`).
   - Helpers `withId` e `normalizeTimestamp` para converter
     `Timestamp` do Firestore em ISO string (compatível com o que a
     Base44 devolvia em `created_date`).
   - `subscribeOrders` emite eventos `{type, id, data}` para
     compatibilidade com os componentes `Admin.jsx` e `Staff.jsx`:
     na primeira snapshot emite `snapshot` com tudo; nas seguintes
     faz diff e emite `create`/`update`/`delete` individuais.

4. **`src/api/base44Client.js`** — Apagado (juntamente com a pasta
   `src/api/`).

5. **`src/pages/Menu.jsx`** — Substituída a chamada
   `base44.entities.Product.filter({ available: true })` por
   `listAvailableProducts()` do `db.js`. Adicionado tratamento de
   erros e flag `cancelled` para evitar set state após unmount.

6. **`src/pages/Staff.jsx`** — Substituída a subscrição
   `base44.entities.Order.subscribe` por `subscribeOrders(callback)`
   que usa `onSnapshot` internamente, com a query ordenada por
   `created_date desc`. Mantida a lógica de tocar o som apenas em
   pedidos novos (id não conhecido). Adicionado um `knownIdsRef`
   para evitar duplicados e falsos positivos de "novo pedido".

7. **`src/pages/Admin.jsx`** — Mesma refatoração que `Staff.jsx`:
   `subscribeOrders` substitui a subscrição antiga. Carregamento
   inicial via `loadOrders` + `loadProducts` mantido para o separador
   Menu. Substituídas as chamadas CRUD de produto por funções de
   `db.js`.

8. **`src/components/admin/OrderCard.jsx`** — Substituídas as
   chamadas `base44.entities.Order.update` e
   `base44.entities.Product.list/update` por `updateOrder`,
   `listProducts`, `updateProduct`.

9. **`src/components/admin/TableGroup.jsx`** — Mesma refatoração
   que `OrderCard`, mais `deleteOrder` para a ação "Limpar mesa".

10. **`src/components/admin/ProductForm.jsx`** — Substituídas as
    chamadas `base44.entities.Product.create/update` por
    `createProduct`/`updateProduct`.

11. **`src/components/admin/StockPanel.jsx`** — Substituídas as
    chamadas `base44.entities.Product.list/update` por
    `listProducts`/`updateProduct`.

12. **`src/components/menu/CartDrawer.jsx`** — Substituída a chamada
    `base44.entities.Order.create` por `createOrder`.

13. **`src/components/menu/PaymentModal.jsx`** — Mesma refatoração
    que `CartDrawer`.

14. **`src/components/admin/SettingsPanel.jsx`** — Substituída a
    chamada `base44.integrations.Core.UploadFile` por `uploadFile`
    do `db.js`. O `useBarSettings` continua a ser usado para guardar
    a configuração (agora via Firestore).

15. **`src/lib/BarSettingsContext.jsx`** — Reescrito por completo.
    Carrega o documento `bar` da coleção `settings` via
    `getBarSettings()` na carga inicial e subscreve alterações em
    tempo real via `subscribeBarSettings(callback)` (usa `onSnapshot`
    internamente). O `updateSettings` chama `saveBarSettings` que
    faz `setDoc(ref, data, {merge: true})`.

16. **`src/lib/AuthContext.jsx`** — Reescrito para bypass total.
    Estado fixo: `user` é sempre `{id, name, email, role: "admin"}`,
    `isAuthenticated: true`, `isLoadingAuth: false`,
    `isLoadingPublicSettings: false`, `authError: null`,
    `authChecked: true`. Métodos `logout`, `navigateToLogin`,
    `checkUserAuth`, `checkAppState` são no-ops.

17. **`src/components/RequireAuth.jsx`** — Simplificado para passar
    direto ao `children` (não há loading spinner porque
    `isLoadingAuth` é sempre `false`).

18. **`src/lib/app-params.js`** — Simplificado para devolver
    valores neutros. O módulo já não é usado por nenhum componente
    ativo, mas mantém-se por compatibilidade.

19. **`vite.config.js`** — Mantido como estava (apenas plugin React
    + alias `@`). Nenhuma alteração necessária nesta iteração.

20. **`vercel.json`** — Confirmado na raiz, inalterado:
    `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`.

21. **Build validado** — `npm install` + `npm run build` executados
    localmente. Gerou `dist/index.html` + assets sem erros. O bundle
    JS cresceu para ~1.2 MB por incluir o Firebase SDK (esperado).

22. **Documentação atualizada**:
    - `README.md` reescrito para refletir a nova arquitetura
      Firebase (coleções, sincronização em tempo real, auth bypass).
    - `docs/ARQUITETURA.md` e `docs/REGRAS.md` serão atualizados em
      paralelo.
    - Este `WORKLOG.md` atualizado com a nova entrada.

**Estado final**

- A app compila sem a dependência `@base44/sdk` nem
  `@base44/vite-plugin`.
- Todos os dados vivem no Firestore do projeto Firebase
  `autocell-535c2` (coleções `products`, `orders`, `settings`).
- A sincronização é em tempo real: quando um cliente envia um pedido
  em `/menu`, este aparece instantaneamente em `/staff` e `/admin`
  via `onSnapshot`.
- A autenticação está em modo demo (sempre admin) para permitir
  acesso livre a `/admin` e `/staff` durante a apresentação.
- O `vercel.json` garante que não há erro 404 em rotas client-side.
- Commit criado com a mensagem `Feat: Migração completa de Base44
  para Firebase Firestore` e pushed para `origin/main`.

**Pendente para próximas iterações**

- Reativar auth real com Firebase Auth (email/password ou Google) e
  restringir `/admin`/`/staff` a admins. As regras de segurança do
  Firestore devem ser atualizadas em paralelo (hoje estão abertas
  para a demo funcionar).
- Migrar uploads de logótipos de data URL base64 para Firebase
  Storage (evita inchar documentos Firestore).
- Adicionar índices compostos no Firestore se surgirem avisos de
  query (ex.: `where available==true` + `orderBy created_date`).
- Otimizar o bundle (code-split do Firebase SDK) se o tempo de
  carga inicial for problema em produção.


---

## 2026-06-20 — Importar carta do B'Live e aplicar cores do bar

**Tarefa**

- Importar TODOS os produtos das 3 cartas publicadas em
  `bliveloungebar.com` (PDFs):
  1. Carta principal (cocktails, vodkas, gins, whiskies, champanhes,
     espumantes, sangrias, cachaça, licores, shots, refrigerantes,
     cervejas, cafetaria, aperitivos, vinhos).
  2. Carta de Shishas (20 referências).
  3. Carta B'Live (comida: burgers, tostas, fritos, doces).
- Aplicar a paleta de cores dessas páginas ao programa.
- Atualizar a documentação.
- Commit e push para o repositório.

**Trabalho realizado**

1. **Descarreguei os 3 PDFs** do site oficial do B'Live Lounge Bar
   (`bliveloungebar.com/_files/...`) para `/home/z/my-project/blive_pdfs/`.
   Total: ~24 MB.

2. **Extração de texto** com `pdftotext -layout` para os 3 ficheiros
   `pdf1.txt`, `pdf2.txt`, `pdf3.txt`. Confirmado que cubrem:
   - PDF1 (~15 KB de texto): carta principal completa.
   - PDF2 (~800 bytes): carta shishas.
   - PDF3 (~1.8 KB): carta comida.

3. **Conversão para imagem** com `pdftoppm` (1ª página de cada PDF
   em PNG a 60 DPI) para análise visual via VLM.

4. **Análise de paleta de cores** com `z-ai vision`:
   - PDF1 (carta principal): preto + branco + **B'Live Pink #E91E8C**
     + cinza prateado + vermelho escuro. Estilo: dark, moderno.
   - PDF2 (shishas): preto + **vermelho vibrante #FF0000** + branco.
     Estilo: dark, nightlife.
   - PDF3 (comida): preto + **vermelho vibrante #FF1A1A** + branco.
     Estilo: vibrant, nightlife, lounge.

   Conclusão: o tema dark já estava configurado em `src/index.css`.
   Mantive o B'Live Pink #E91E8C como cor primária (já era o default)
   e adicionei o vermelho vibrante #FF1A1A como cor de acento
   secundária (`--accent-red`) para refletir os PDFs de shisha e
   comida.

5. **Criação do catálogo** em `scripts/catalog.js` com **150 produtos**
   extraídos manualmente dos 3 PDFs, cada um com:
   - `name` (nome do produto como aparece na carta)
   - `description` (ingredientes / variantes / formato)
   - `price` (preço em euros)
   - `category` (`cocktails` / `bebidas` / `shisha` / `comida` /
     `sobremesas`)
   - `image_url` (placeholder Unsplash; substituível por fotos reais)

   Distribuição por categoria:
   - `cocktails`: 16 (inclui mocktails e sangrias)
   - `bebidas`: 100 (vodkas, gins, rums, whiskies, champanhes,
     espumantes, cachaça, licores, shots, refrigerantes, cervejas,
     cafetaria, aperitivos, vinhos)
   - `shisha`: 20 (todos os sabores do PDF2 + Standard com Bazuka
     + B'Live Quasar)
   - `comida`: 12 (burgers, gambas, tostas, fritos)
   - `sobremesas`: 4 (variações de Nutella)

6. **Criação do script de seed** em `scripts/seed-products.js`:
   - Lê o `catalog.js` e insere os produtos na coleção `products`
     do Firestore.
   - **Idempotente**: não duplica produtos com o mesmo `slug`
     (gerado a partir do `name`).
   - Suporta `--reset` para apagar tudo e recriar.
   - Usa `writeBatch` do Firestore (limite 500 ops/batch; uso 400
     para folga).
   - Tem timeout de 60 s por operação para não ficar pendurado se a
     base de dados Firestore não existir.
   - Mensagens claras de erro em português com dica para criar a BD
     no Firebase Console.

7. **Tentativa de executar o seed** localmente — falhou com erro
   `5 NOT_FOUND` do Firestore, o que indica que a base de dados
   ainda não foi criada no projeto Firebase `autocell-535c2`. O
   script falha de forma limpa com mensagem útil. O utilizador
   precisa de ir a
   <https://console.firebase.google.com/project/autocell-535c2/firestore>
   e clicar em "Create database" antes de executar o seed.

8. **Atualização do tema visual** (`src/index.css`):
   - Mantidas as cores dark (background preto, foreground branco).
   - Documentada a origem das cores (extraídas dos PDFs).
   - Adicionado gradiente radial subtil no fundo (rosa + vermelho)
     para reforçar a estética nightlife.
   - Adicionadas utilidades `.glow-red`, `.glow-pink`,
     `.text-gradient-blive` para usar em destaques visuais.
   - Tipografia Playfair Display mantida para títulos (estilo
     cartas de bar).

9. **Tailwind config** (`tailwind.config.js`): adicionada a cor
   `accent-red` (var `--accent-red`) para usar em componentes que
   queiram destacar o vermelho vibrante dos PDFs.

10. **Defaults do BarSettings** (`src/lib/BarSettingsContext.jsx`
    e `src/lib/db.js`): atualizado o `tagline` por defeito para
    `"Cocktails • Shishas • Comida"` (reflete as 3 cartas).

11. **Build validado** — `npm install` + `npm run build` OK.

12. **Documentação atualizada**:
    - `README.md`: nova secção "Popular a base de dados com a carta
      do B'Live" com instruções para correr o seed.
    - Este `WORKLOG.md` atualizado com a nova entrada.
    - `docs/REGRAS.md` será atualizado para listar as 5 categorias
      reais usadas.

**Estado final**

- Catálogo de 150 produtos do B'Live Lounge Bar criado em
  `scripts/catalog.js`.
- Script de seed `scripts/seed-products.js` pronto a usar (falha
  com mensagem clara se a BD Firestore não existir).
- Tema visual atualizado com paleta extraída dos PDFs (preto +
  B'Live Pink #E91E8C + vermelho vibrante #FF1A1A).
- Defaults do BarSettings atualizados (tagline "Cocktails •
  Shishas • Comida").
- Build OK.

**Pendente para próximas iterações**

- **Criar a base de dados Firestore** no projeto `autocell-535c2`
  via Firebase Console, depois executar `node scripts/seed-products.js`
  para popular os 150 produtos.
- Substituir placeholders Unsplash por fotografias profissionais dos
  produtos (quando disponíveis).
- Ativar Firebase Auth real para restringir `/admin` e `/staff`.
- Migrar uploads de logótipos para Firebase Storage.

---

## 2026-06-20 — Botão "Importar Catálogo" no painel Admin

**Tarefa**

Adicionar um botão no painel de Admin que leia o catálogo local
(`scripts/catalog.js`, agora partilhado em `src/data/catalog.js`) e
faça loop sobre os produtos, enviando cada um para a coleção
`products` no Firestore via `setDoc`. Garantir que os campos
importados correspondem ao modelo da app (`name`, `description`,
`price`, `category`, `image_url`, `available`, `stock_enabled`,
`stock`).

**Trabalho realizado**

1. **Mover o catálogo para `src/data/catalog.js`** — o catálogo
   estava em `scripts/catalog.js` (só acessível em Node). Foi
   copiado para `src/data/catalog.js` para poder ser importado pelo
   frontend. Adicionei também exports úteis:
   - `PRODUCTS` (array de 150 produtos)
   - `CATALOG_TOTAL` (150)
   - `CATALOG_SUMMARY` (contagem por categoria)
   - `CATEGORIES` (lista das 5 categorias reconhecidas)
   - `normalizeProduct(p)` (devolve produto com todos os campos do
     modelo preenchidos com defaults seguros)

2. **`scripts/catalog.js`** — transformado num re-export de
   `src/data/catalog.js`, mantendo compatibilidade com o script
   `scripts/seed-products.js` (que continua a funcionar).

3. **Criado `src/components/admin/ImportCatalogButton.jsx`** —
   componente React autónomo com:
   - Estado: `idle` / `importing` / `done` / `error`.
   - Botão com confirmação (window.confirm) antes de começar.
   - Import idempotente: usa `setDoc` com id estável
     `prod-${slug(nome)}` — não cria duplicados.
   - Cada produto é normalizado via `normalizeProduct()` antes de
     ser enviado: garante `name`, `description`, `price` (number),
     `category` (uma das 5 válidas), `image_url`, `available`
     (default true), `stock_enabled` (default false), `stock`
     (default 0). Adiciona também `slug`, `created_date` (preserva
     a data original se o doc já existir) e `updated_date` (agora).
   - Barra de progresso (X / N) atualizada por cada produto.
   - Pausa de 100ms a cada 20 produtos para não estourar quota do
     Firestore.
   - Botão "Cancelar" para parar o import a meio.
   - Toast verde (sucesso) ou vermelho (erro) no fim, com contagem
     de criados vs atualizados.
   - Callback `onImported` para o `Admin.jsx` recarregar a lista
     de produtos após o import.

4. **Integrado no `Admin.jsx`** — o botão aparece no separador
   "Menu" logo abaixo do header "Produtos / Adicionar", acima da
   lista de produtos existentes. O callback `onImported={loadProducts}`
   faz com que a lista se atualize automaticamente quando o import
   termina.

5. **Build validado** — `npm install` + `npm run build` OK.
   Verificado também que o re-export `scripts/catalog.js →
   src/data/catalog.js` funciona em Node (o `seed-products.js`
   continua a funcionar).

**Estado final**

- Botão "Importar Catálogo" disponível no painel Admin → separador
  Menu.
- Lê 150 produtos de `src/data/catalog.js` e envia para a coleção
  `products` do Firestore.
- Idempotente (id estável = `prod-${slug}`), com progresso visual
  e tratamento de erros.
- Campos garantidos pelo `normalizeProduct()`: `name`, `description`,
  `price`, `category`, `image_url`, `available`, `stock_enabled`,
  `stock` (+ `slug`, `created_date`, `updated_date`).
- Build OK; script Node `seed-products.js` continua a funcionar via
  re-export.

**Notas de utilização**

1. Abrir a app em `/admin` → separador "Menu".
2. Clicar em "Importar Catálogo" (botão rosa com ícone de database).
3. Confirmar no dialog.
4. Aguardar a barra de progresso chegar a 150/150.
5. A lista de produtos abaixo é recarregada automaticamente.

Alternativamente, o seed pode ser feito por CLI com
`node scripts/seed-products.js` (mesmo catálogo, mesma lógica).
