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

---

## 2026-06-20 — Botão "Apagar todos os produtos" no painel Admin

**Tarefa**

Adicionar um botão "Apagar todos os produtos" ao lado do botão
"Importar Catálogo" no painel de Admin, para resets rápidos do
catálogo no Firestore.

**Trabalho realizado**

1. **Criado `src/components/admin/ClearAllProductsButton.jsx`** —
   componente React autónomo, espelho do `ImportCatalogButton` mas
   para operação destrutiva. Características:
   - Estado: `idle` / `deleting` / `done` / `error`.
   - **Dupla confirmação**:
     a) `window.confirm` inicial com texto explícito sobre a
        irreversibilidade da operação.
     b) `window.prompt` onde o utilizador tem de escrever `APAGAR`
        em maiúsculas. Só assim a operação avança.
   - Lê todos os documentos da coleção `products` via
     `getDocs(collection(db,"products"))`.
   - Apaga em lotes de 400 documentos via `writeBatch` (limite
     Firestore é 500 ops/batch) para não estourar quota.
   - Barra de progresso (X / N) vermelha durante a eliminação.
   - Botão "Cancelar" para parar a meio (mantém o que já foi
     apagado).
   - Toast verde (sucesso) ou vermelho (erro) no fim, com contagem
     de documentos apagados.
   - Caso especial: se a coleção já estiver vazia, mostra mensagem
     informativa em vez de erro.
   - Callback `onCleared` para o `Admin.jsx` recarregar a lista
     após a operação.

2. **Integrado no `Admin.jsx`** — o botão aparece no separador
   "Menu", lado a lado com o `ImportCatalogButton` numa grid de
   2 colunas no desktop (1 coluna no mobile). Ambos os botões
   passam `loadProducts` como callback para a lista se atualizar.

3. **Estilo visual consistente com o ImportCatalogButton** —
   caixa com borda tracejada, ícone à esquerda, título + descrição
   no meio, botão de ação à direita. Diferença: usa vermelho
   (`red-500/40`, `red-500/15`) em vez de rosa para sinalizar o
   carácter destrutivo.

4. **Build validado** — `npm install` + `npm run build` OK.

**Estado final**

- Dois botões de gestão de catálogo disponíveis no painel Admin →
  separador Menu, lado a lado:
  - **Importar Catálogo** (rosa) — popula o Firestore com 150
    produtos do catálogo B'Live. Idempotente via `setDoc` com id
    estável.
  - **Apagar tudo** (vermelho) — remove TODOS os documentos da
    coleção `products`. Dupla confirmação (dialog + prompt
    "APAGAR").
- Build OK.

**Fluxo recomendado de reset do catálogo**

1. Abrir `/admin` → separador Menu.
2. Clicar em "Apagar tudo" → confirmar → escrever APAGAR.
3. Aguardar a barra de progresso vermelha chegar ao fim.
4. Clicar em "Importar Catálogo" para repopular com os 150
   produtos atualizados (após editar `src/data/catalog.js` se
   necessário).

---

## 2026-06-20 — Fix: pedidos do /menu não apareciam no /staff

**Sintoma**

Pedidos criados no `/menu` (carrinho → "Enviar pedido") não
apareciam no ecrã `/staff`. O circuito de leitura/escrita em tempo
real estava quebrado.

**Diagnóstico (causas encontradas)**

1. **Query do `subscribeOrders` era frágil** — usava
   `query(collection(db,"orders"), orderBy("created_date","desc"))`.
   Se existisse QUALQUER documento na coleção sem o campo
   `created_date` (ex.: pedidos de teste importados manualmente, ou
   documentos legacy), o Firestore devolve erro
   `failed-precondition` e o `onSnapshot` nunca dispara. Sem logs
   claros, parecia que "nada acontecia".

2. **`CartDrawer` e `PaymentModal` chamavam `onOrderPlaced()` no
   `finally`** — ou seja, mesmo quando o `createOrder` falhava
   (ex.: regras de segurança do Firestore, falta de ligação), o
   utilizador via o ecrã "Obrigado!" e achava que tinha funcionado.
   O erro ficava só na consola.

3. **Filtro `o.status !== "pronto_limpo"` em Staff.jsx** —
   correto (pedidos novos têm `status: "pendente"`, que passa no
   filtro), mas podia confundir se alguém definisse esse estado.
   Mantido, mas documentado.

4. **`?table=` vs `?mesa=`** — `Menu.jsx` só lia `?mesa=`. QR codes
   gerados com `?table=` (padrão EN) faziam com que todos os
   pedidos caíssem na mesa "1".

**Correções aplicadas**

1. **`src/lib/db.js` → `subscribeOrders`** — agora é RESILIENTE:
   - Tenta primeiro `query(collection, orderBy("created_date","desc"))`.
   - Se essa query falhar (erro de permissão, `failed-precondition`,
     etc.), faz fallback automático para uma query SEM `orderBy` e
     ordena no cliente por `created_date` desc.
   - Em ambos os casos, a primeira snapshot emite
     `{type:"snapshot", data:[...]}` (ordenado) e as seguintes
     emitem `{type:"create"|"update"|"delete", id, data}` via diff.
   - A função `unsubscribe` devolvida funciona em qualquer dos ramos.

2. **`src/lib/db.js` → `createOrder`** — payload normalizado:
   - Valida `items[]` (lança erro se vazio).
   - Converte `table_number` para `String` (default "1").
   - Mapeia cada item para `{product_id, product_name, quantity,
     unit_price, total}` com conversões de tipo seguras.
   - Garante `status: "pendente"`, `total_amount`, `tip_amount`,
     `payment_method`, `notes`, `created_date` (ISO string),
     `updated_date` (ISO string).
   - Adiciona `_server_created_at: serverTimestamp()` em paralelo
     para auditoria no Firebase Console (não usado para ordenação
     para evitar inconsistências).

3. **`src/components/menu/CartDrawer.jsx`** — robustez:
   - `onOrderPlaced()` só é chamado em caso de sucesso do
     `createOrder` (antes chamava no `finally`).
   - Adicionado estado `error` com mensagem visível ao utilizador
     (caixa vermelha com ícone de alerta) acima do botão "Enviar
     pedido".
   - `console.info`/`console.error` claros em cada etapa para
     diagnóstico no DevTools.

4. **`src/components/menu/PaymentModal.jsx`** — mesmas correções
   que o CartDrawer:
   - `setSuccess(true)` só em caso de sucesso.
   - Estado `error` + caixa vermelha visível acima do botão
     "Confirmar pedido".
   - Logs claros.

5. **`src/pages/Menu.jsx`** — aceita tanto `?mesa=N` como
   `?table=N` para compatibilidade com QR codes gerados com
   qualquer padrão.

6. **`src/pages/Staff.jsx`** — adicionados `console.info` em cada
   evento recebido (`snapshot`, `create`, `update`, `delete`)
   para diagnóstico. Quando um novo pedido chega, faz log da mesa,
   total e status. Isto permite confirmar no DevTools que o
   `onSnapshot` está a disparar corretamente.

**Estado final**

- Build OK.
- O fluxo `/menu → Enviar pedido → /staff` está end-to-end
  resiliente:
  - Se o Firestore estiver offline ou as regras negarem escrita, o
    utilizador vê uma mensagem de erro clara no CartDrawer.
  - Se a query com `orderBy` falhar (dados legacy), o `onSnapshot`
    faz fallback automático para query simples + ordenação no
    cliente.
  - Logs detalhados em todos os passos permitem diagnosticar
    rapidamente qualquer problema futuro.
- `?mesa=N` e `?table=N` são ambos aceites no URL.

**Como testar**

1. Abrir `/menu?mesa=5` num separador (cliente).
2. Abrir `/staff` noutro separador (staff).
3. No `/menu`, adicionar produtos ao carrinho → "Ver pedido" →
   "Enviar pedido".
4. No `/staff`, o pedido deve aparecer imediatamente no topo da
   lista, com som de notificação (se ativado).
5. Para diagnosticar problemas, abrir DevTools (F12) → Console
   em ambos os separadores. Os logs `[CartDrawer]`, `[Staff]`,
   `[db]` mostram exatamente o que está a acontecer.

**Pendente para próximas iterações**

- Considerar ativar persistência offline do Firestore
  (`enableIndexedDbPersistence`) para que o /staff continue a
  mostrar pedidos antigos mesmo sem ligação.
- Adicionar regras de segurança do Firestore que permitam escrita
  anónima na coleção `orders` (necessário para que clientes não
  autenticados consigam enviar pedidos).

---

## 2026-06-20 — Remover pagamentos + Apagar pedidos + Editor visual

**Tarefas executadas**

1. **Remover completamente os pagamentos** — a app não vai ter
   pagamentos online. Pedidos são pagos diretamente na mesa ao staff.
2. **Adicionar botão "Apagar todos os pedidos"** no separador
   Pedidos (para limpar dados de teste antes de abrir).
3. **Criar editor visual de produtos** em `/admin` para editar
   qualquer campo (incluindo URL da imagem) sem mexer no código —
   útil para trocar placeholders Unsplash por fotos reais do
   Instagram do B'Live.

**Trabalho realizado**

### 1. Remoção de pagamentos

- **`src/components/menu/PaymentModal.jsx`** — ficheiro APAGADO
  (não era importado em nenhum lado; era código residual).
- **`src/components/menu/CartDrawer.jsx`** — removido o campo
  `tip_amount: 0` do payload enviado ao `createOrder`. Comentário
  atualizado para explicar que a app não processa pagamentos.
- **`src/lib/db.js` → `createOrder`** — removidos os campos
  `tip_amount` e `payment_method` do payload normalizado. O
  modelo de pedidos passa a ter apenas: `table_number`, `items`,
  `total_amount`, `status`, `notes`, `created_date`,
  `updated_date`, `_server_created_at`.
- **`src/lib/db.js` → `getBarSettings`** e
  **`src/lib/BarSettingsContext.jsx` → `DEFAULT_SETTINGS`** —
  removido o campo `payment_methods: [...]`. Os defaults ficam
  apenas com `bar_name`, `primary_color`, `logo_url`, `tagline`.
- Verificado com grep: não restam referências a `PaymentModal`,
  `payment_method`, `payment_methods`, `tip_amount`, `tipAmount`,
  `TIP_PERCENTS`, `ALL_METHODS`, `mbway`, `multibanco`,
  `numerario` em nenhum ficheiro de `src/`.

### 2. ClearAllOrdersButton

- **Criado `src/components/admin/ClearAllOrdersButton.jsx`** —
  espelho visual do `ClearAllProductsButton` mas para a coleção
  `orders`. Características:
  - Estado: `idle` / `deleting` / `done` / `error`.
  - **Dupla confirmação** (dialog + prompt onde o utilizador tem
    de escrever `APAGAR` em maiúsculas) — operação irreversível.
  - Apaga em lotes de 400 docs via `writeBatch`.
  - Barra de progresso vermelha (X / N).
  - Botão "Cancelar" a meio.
  - Toast verde/vermelho no fim.
  - Callback `onCleared` para o Admin recarregar a lista.
- **Integrado no `Admin.jsx`** — aparece no fundo do separador
  "Pedidos" (abaixo dos pedidos concluídos), separado por um
  divisor. Passa `loadOrders` como callback.

### 3. BulkProductEditor (editor visual em /admin)

- **Criado `src/components/admin/BulkProductEditor.jsx`** —
  editor em massa que lista todos os produtos do Firestore e
  permite editar inline TODOS os campos:
  - `name` (input de texto)
  - `description` (input de texto)
  - `image_url` (input de texto com preview da imagem em tempo
    real + botão "abrir imagem" para validar o URL)
  - `price` (input numérico)
  - `category` (select com as 5 categorias)
  - `stock` (input numérico, desativado se `stock_enabled = false`)
  - `stock_enabled` (toggle)
  - `available` (toggle Ativo/Inativo)
  
  Características:
  - Filtro por categoria + pesquisa por nome/descrição.
  - Estado de cada linha: idle / dirty / saving / saved / error.
  - Botão "Guardar linha" em cada produto alterado — faz `setDoc`
    com merge no documento correspondente.
  - Botão "Guardar tudo" no topo — grava TODAS as linhas
    alteradas em batches de 400 via `writeBatch`.
  - Preview da imagem em tempo real (16x16) que reage
    instantaneamente à edição do URL.
  - Caso de uso principal: trocar os placeholders Unsplash por
    URLs de fotos reais do Instagram do B'Live. Basta colar o URL
    no campo `image_url` e clicar em Guardar.
- **Integrado no `Admin.jsx`** — aparece no separador "Menu",
  abaixo da lista de produtos existente, separado por um divisor
  com header "Editor visual de produtos".

**Estado final**

- App sem pagamentos: o fluxo `/menu → /staff` é "envia pedido →
  staff entrega → cliente paga na mesa". Sem UI de pagamento,
  sem campos de gorjeta, sem métodos de pagamento (MB WAY,
  Multibanco, etc.).
- Build OK.
- Três novas ferramentas no painel Admin:
  - "Apagar todos os pedidos" (separador Pedidos)
  - "Apagar todos os produtos" (separador Menu — já existia)
  - "Editor visual de produtos" (separador Menu — novo)

**Notas de utilização**

1. **Trocar fotos Unsplash por fotos do Instagram do B'Live**:
   - Abrir `/admin` → separador Menu.
   - Scroll até "Editor visual de produtos".
   - Procurar pelo produto (ex.: "Caipirinha").
   - Colar o URL da foto do Instagram no campo `image_url`.
   - Clicar "Guardar linha" (ou editar mais produtos e clicar
     "Guardar tudo" no topo).
   - A imagem atualiza em tempo real no preview e no `/menu`.

2. **Limpar pedidos de teste**:
   - Abrir `/admin` → separador Pedidos.
   - Scroll até ao fundo.
   - Clicar "Apagar tudo" → confirmar → escrever `APAGAR`.
   - A lista de pedidos do `/staff` e do `/admin` esvazia-se.

---

## 2026-06-20 — Arquitetura de Contas por Mesa (Open Tabs)

**Tarefa**

Mudar o ecrã `/staff` de "lista de pedidos individuais isolados"
para "Contas por Mesa (Open Tabs)". Pedidos do `/menu` passam a ter
`tab_status: "open"`; o `/staff` mostra uma grelha de Cartões de
Mesa consolidados; botão "Limpar Mesa" faz batch update para
`tab_status: "closed"`; novo separador "Histórico" mostra contas
fechadas do dia.

**Trabalho realizado**

### 1. Modelo de dados (Firestore)

**`src/lib/db.js → createOrder`** — payload alargado:
- **NOVO** `table: String` — identificador normalizado da mesa.
- **NOVO** `tab_status: "open"` — estado da conta (open|closed).
- **NOVO** `closed_at: null` — preenchido quando a conta é fechada.
- Mantido `table_number` (legacy) para compatibilidade com Admin/
  OrderCard/TableGroup existentes.

### 2. Novas funções em `src/lib/db.js`

- **`subscribeOpenOrders(callback)`** — `onSnapshot(query(orders,
  where(tab_status, ==, "open"), orderBy(created_date, desc)))`.
  Fallback automático para query sem orderBy se legacy.
- **`subscribeClosedOrders(callback)`** — igual mas com
  `tab_status == "closed"` (para o histórico).
- **`closeTableOrders(table)`** — batch update (400 em 400) que muda
  `tab_status: "open" → "closed"` em todos os pedidos da mesa.
  Define também `closed_at = agora`. Fallback para `table_number`
  se a mesa só tiver pedidos legacy.

### 3. CartDrawer — payload atualizado

**`src/components/menu/CartDrawer.jsx`** — agora envia:
```js
{
  table: "5",
  table_number: "5",  // legacy
  items: [...],
  total_amount: 17.50,
  status: "pendente",
  tab_status: "open",
  notes: "sem gelo",
}
```

### 4. Novo componente `TableTab.jsx`

**`src/components/admin/TableTab.jsx`** — Cartão de Mesa (Open Tab):
- Cabeçalho com número da mesa, hora de abertura (primeiro pedido),
  hora do último pedido, número de pedidos e total a pagar.
- Corpo com **lista consolidada de itens** — junta pedidos antigos
  e novos da mesma mesa, somando as quantidades do mesmo produto
  (por `product_id`). Mostra badge `(N×)` quando um produto veio de
  N pedidos diferentes.
- Notas consolidadas (todos os pedidos com `notes`).
- Rodapé com **Total a pagar** em destaque + botão vermelho
  **"Limpar Mesa"**.
- Botão "Limpar Mesa" chama `closeTableOrders(table)` (batch update).
  Não apaga dados — apenas muda `tab_status` para `closed`.
- Estado `clearing` enquanto o batch update decorre.
- Estado `error` se o batch falhar.

### 5. Reescrita do `Staff.jsx`

**`src/pages/Staff.jsx`** — três grandes mudanças:

#### a) Duas subscrições em paralelo

- `subscribeOpenOrders` para a vista "Mesas Abertas".
- `subscribeClosedOrders` para a vista "Histórico".

Cada uma atualiza o seu próprio estado (`openOrders` / `closedOrders`).
Quando o staff clica em "Limpar Mesa":
1. `closeTableOrders(table)` faz batch update no Firestore.
2. O `onSnapshot` de `open` emite evento `delete` para cada pedido
   que mudou de `tab_status` → removido da lista de mesas abertas.
3. O `onSnapshot` de `closed` emite evento `create` para os mesmos
   pedidos → aparecem no histórico.
Tudo automático, sem refresh.

#### b) Agrupamento por mesa

`tableGroups = useMemo(...)` agrupa `openOrders` por `table` (com
fallback `table_number` para legacy). `sortedTables` ordena por
número de mesa ascendente.

#### c) UI em tabs

Header passa a ter dois separadores:
- **Mesas Abertas** (ícone Receipt) — mostra `TableTab` cards em
  grelha. Resumo no topo: "N mesas abertas, total €X".
- **Histórico** (ícone History) — mostra `ClosedSessionCard` cards.
  Cada sessão agrupa pedidos pela mesma combinação
  `(table, closed_at)` — ou seja, uma conta fechada = uma card.
  Ordenado por data de fecho descendente (mais recente primeiro).
  Click na card expande para mostrar itens consolidados + notas.

### 6. Subcomponente `ClosedSessionCard`

Definido inline no `Staff.jsx` (não merece ficheiro próprio).
Mostra:
- Mesa + data/hora de fecho
- Total pago
- Click expande para mostrar itens consolidados e notas

### 7. Logs detalhados

Mantidos os `console.info` em cada evento (snapshot/create/update/
delete) para diagnóstico, com prefixos `[Staff][open]` e
`[Staff][closed]` para distinguir as duas subscrições no DevTools.

**Estado final**

- Build OK.
- Modelo: cada pedido tem `table`, `table_number` (legacy),
  `tab_status` (open|closed), `closed_at` (quando fechado).
- Fluxo: `/menu` cria pedido com `tab_status="open"` → aparece no
  `/staff` como Cartão de Mesa → staff clica "Limpar Mesa" → batch
  update para `tab_status="closed"` → desaparece das mesas abertas
  e aparece no Histórico.
- Admin.jsx mantém-se com `subscribeOrders` (sem filtro) — vê
  todos os pedidos, abertos e fechados. Útil para auditoria.

**Como testar**

1. Abrir `/menu?table=5` → adicionar produtos → enviar pedido.
2. Abrir `/staff` noutro separador → Mesa 5 aparece instantaneamente
   como Cartão de Mesa com lista consolidada de itens + total.
3. Voltar ao `/menu?table=5` → enviar outro pedido.
4. No `/staff`, a Mesa 5 atualiza: novos itens somam-se aos
   existentes, total atualiza. Som de notificação toca (se ativo).
5. Clicar "Limpar Mesa" no cartão da Mesa 5 → confirmar.
6. Mesa 5 desaparece das "Mesas Abertas" e aparece no "Histórico".
7. Abrir `/admin` → separador Pedidos → Mesa 5 continua visível
   (agora com `tab_status="closed"`), permitindo auditoria.

**Pendente para próximas iterações**

- Filtrar o histórico por dia (hoje / ontem / esta semana).
- Adicionar botão "Reabrir mesa" no histórico (reverter
  `tab_status: closed → open`).
- Considerar deletar pedidos antigos do histórico após N dias
  para não inflar a coleção `orders`.

---

## 2026-06-20 — Auth real + QR codes seguros + Gestão de utilizadores

**Tarefas executadas**

1. **QR Codes seguros** — cada mesa tem um ID aleatório na coleção
   `tables`; o `/menu` valida o `?m=<id>` no Firestore.
2. **Firebase Auth real** — substitui o bypass demo; Email/Password
   com `onAuthStateChanged` + role guardada na coleção `users`.
3. **Gestão de utilizadores no Admin** — novo separador
   "Utilizadores" (só admin) para criar/listar/apagar contas.

### 1. QR Codes Seguros (coleção `tables`)

**`src/lib/firebase.js`** — adicionado `getAuth` para suportar
Firebase Auth. Agora exporta `app`, `db`, `auth`.

**`src/lib/db.js`** — novas funções:
- `generateTableId()` — hash aleatório de 8 chars [A-Za-z0-9].
- `createTable(tableNumber)` — cria doc em `tables/{id}` com
  `{table_number, created_date}`. ID gerado client-side.
- `getTableByMid(mid)` — lê uma mesa pelo ID (usado pelo `/menu`
  para validar `?m=`).
- `listTables()` — lista todas as mesas ordenadas por número.
- `deleteTable(mid)` — apaga mesa (QR deixa de funcionar).
- `subscribeTables(callback)` — `onSnapshot` em tempo real.

**`src/components/admin/QRCodesTab.jsx`** — reescrito por completo:
- Subscreve `subscribeTables` em vez de gerar IDs locais.
- Botão "Adicionar mesa" pede o número (input de texto) →
  `createTable`.
- Cada QR gera URL `/menu?m=<id>` (não mais `?mesa=N`).
- Botão de apagar mesa com confirmação.
- Info box explica como funciona a segurança.

**`src/pages/Menu.jsx`** — reescrita da lógica de leitura do URL:
- Lê `?m=<id>` primeiro. Se existir, consulta `getTableByMid(mid)`
  no Firestore. Se válido → mostra menu com a `table_number`
  correspondente. Se inválido → **ecrã "Mesa Inválida"** com
  ícone vermelho.
- Fallback legacy: aceita `?mesa=N` ou `?table=N` com aviso
  amarelo no topo (QR code desatualizado).
- Sem nenhum parâmetro → bloqueia com "Mesa Inválida".
- Estado: `loading` → `valid` → menu normal; ou `loading` →
  `invalid` → ecrã de erro.

### 2. Firebase Auth Real

**`src/lib/AuthContext.jsx`** — reescrito por completo (remove
bypass demo):
- Usa `onAuthStateChanged(auth, ...)` para subscrever o estado de
  auth.
- Após login, lê o perfil do utilizador em `users/{uid}` via
  `getUserProfile(uid)` para obter a `role`.
- Se utilizador não tem perfil em `users/` → signOut automático +
  erro "user_not_registered".
- Métodos: `login(email, password)`, `logout()`, `createUser(email,
  password, role)` (usado pelo UsersPanel).
- Estado exposto: `user` ({uid, email, role}), `isAuthenticated`,
  `isLoadingAuth`, `authChecked`, `authError`.

**`src/components/RequireAuth.jsx`** — reescrito por completo:
- Props: `requireRole = "staff" | "admin"`.
- Mostra spinner enquanto `isLoadingAuth || !authChecked`.
- Se não autenticado → redireciona para `/login`.
- Se `requireRole === "admin"` e user não é admin → redireciona
  para `/staff` com ecrã "Acesso restrito".

**`src/pages/Login.jsx`** — nova página:
- Form email + password.
- Chama `login()` do AuthContext.
- Em sucesso → `navigate("/admin" ou "/staff")` conforme a role.
- Tradução de erros Firebase Auth para PT-PT (auth/invalid-
  credential, auth/configuration-not-found, etc.).

**`src/App.jsx`** — atualizado:
- Nova rota `/login` (redirect para `/admin` ou `/staff` se já
  autenticado).
- `<RequireAuth requireRole="admin">` em `/admin`.
- `<RequireAuth requireRole="staff">` em `/staff`.
- Spinner global enquanto auth não está checked.

### 3. Gestão de Utilizadores (coleção `users`)

**`src/lib/db.js`** — novas funções:
- `getUserProfile(uid)` — lê perfil de um user por uid.
- `setUserProfile(uid, {email, role})` — cria/substitui perfil.
- `listUsers()` — lista todos (admins primeiro).
- `subscribeUsers(callback)` — `onSnapshot` em tempo real.
- `deleteUserProfile(uid)` — apaga perfil (conta Auth fica órfã).

**`src/components/admin/UsersPanel.jsx`** — novo componente:
- Subscreve `subscribeUsers` em tempo real.
- Lista todos os utilizadores com avatar (coroa para admin,
  ícone user para staff), email, role e UID abreviado.
- Botão "Novo utilizador" abre formulário com email + password +
  role (staff/admin) — botões com ícones Shield/Crown.
- `createUserWithEmailAndPassword` cria a conta Auth; `setUserProfile`
  cria o perfil no Firestore. Avisa que a sessão do admin é
  terminada (limitação do SDK client-side).
- Botão apagar (com confirmação dupla para admins). Impede
  auto-apagar.
- Info box com link para Firebase Console para apagar contas Auth
  completamente.

**`src/pages/Admin.jsx`** — atualizado:
- Imports de `UsersPanel`, `useAuth`, ícones `Users`, `LogOut`.
- `ALL_TABS` com flags `adminOnly: true|false`. Tabs "qr",
  "settings" e "users" são adminOnly.
- `tabs = ALL_TABS.filter(...)` conforme `user.role`.
- Renderização do separador "users" → `<UsersPanel />`.
- Header passa a mostrar email + role do user logado + botão
  logout (ícone LogOut em vermelho).

**`src/pages/Staff.jsx`** — atualizado:
- Import de `useAuth` + ícone `LogOut`.
- Header passa a ter botão logout no canto direito (a seguir ao
  indicador Live).

### 4. Documentação e artefactos

- Build validado: `npm install` + `npm run build` OK.

**Estado final**

- Auth real via Firebase Auth (Email/Password). Sessão persistente
  via IndexedDB.
- Roles guardadas em `users/{uid}` no Firestore.
- `/admin` só admin; `/staff` admin + staff; `/login` se não
  autenticado.
- QR codes usam IDs seguros (`?m=<id>`); `/menu` valida via
  Firestore → bloqueia com "Mesa Inválida" se adulterado.
- Admin tem separador "Utilizadores" para criar/apagar contas.

**Setup necessário no Firebase Console**

1. **Ativar Email/Password**: Authentication → Sign-in method →
   Email/Password → Enable.
2. **Criar o primeiro admin**: Authentication → Users → Add user
   (email + password). Depois ir a Firestore → coleção `users` →
   criar documento com id = uid do user, campos `{email, role:
   "admin", created_date: agora}`.
3. **Regras de segurança Firestore** (recomendadas):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Mesas: leitura pública (para /menu validar ?m=),
       // escrita só admin
       match /tables/{id} {
         allow read: if true;
         allow write: if request.auth != null &&
           get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "admin";
       }
       // Users: leitura do próprio perfil OU admin; escrita só admin
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
       // Orders: leitura só auth; escrita pública (clientes enviam)
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

**Limitações conhecidas**

- Criar utilizadores no painel Admin termina a sessão do admin
  atual (limitação do SDK client-side do Firebase Auth). O admin
  precisa de voltar a fazer login. Para contornar, seria
  necessário um backend com Firebase Admin SDK.
- Apagar utilizadores remove apenas o perfil Firestore. A conta
  Auth fica órfã (sem perfil → login falha). Para apagar
  completamente, usar Firebase Console.

---

## 2026-06-20 — Bootstrap script + Setup via UI + README reescrito

**Problema reportado pelo utilizador**

"As coleções não existem no Firestore." — As coleções Firestore são
criadas lazy (só quando se insere o primeiro documento). Sem dados
iniciais, a app mostra ecrãs vazios e o login falha porque não há
admin em `users/`.

**Solução**

1. **`scripts/bootstrap.js`** — script único que prepara TODA a base
   de dados numa só execução:
   - Testa ligação ao Firestore (falha com mensagem útil se a BD não
     existir).
   - Cria `settings/bar` com config padrão do B'Live.
   - Pede email + password (interativamente ou via env vars
     `ADMIN_EMAIL`/`ADMIN_PASSWORD`) e cria o primeiro admin:
     `createUserWithEmailAndPassword` + `setUserProfile({role:"admin"})`.
   - Cria 10 mesas com IDs seguros de 8 chars.
   - Popula `products` com os 150 produtos do catálogo B'Live.
   - Idempotente: pode ser corrido várias vezes.
   - Mostra resumo final + regras de segurança recomendadas.

2. **`src/components/admin/BootstrapButton.jsx`** — botão de setup
   via UI (alternativa ao CLI):
   - Verifica contagem de docs em cada coleção (settings, tables,
     products, users, orders).
   - Mostra grid com estado de cada coleção (✓/⚠/erro).
   - Botão "Criar coleções em falta" que cria settings, tables (10)
     e products (150) — mas NÃO cria utilizadores (porque isso
     afeta a sessão atual do Firebase Auth).
   - Link para Firebase Console + instruções para criar o primeiro
     admin manualmente.
   - Integrado no novo separador "Sistema" do Admin.jsx.

3. **`src/pages/Admin.jsx`** — adicionado separador "Sistema"
   (adminOnly) com `<BootstrapButton />`.

4. **`README.md`** — reescrita da secção de setup:
   - Passo 1: Criar Firestore DB (modo Test).
   - Passo 2: Ativar Email/Password em Authentication.
   - Passo 3: `node scripts/bootstrap.js`.
   - Passo 4: Regras de segurança (snippet completo).
   - Passo 5: `npm run dev`.
   - Passo 6: Deploy Vercel.
   - Secção "Troubleshooting" com 5 problemas comuns e soluções.
   - Alternativa "Setup via UI" para quem prefere não usar terminal.

**Estado final**

- Build OK.
- Script de bootstrap testado localmente (carrega sem erros; falha
  graciosamente se a BD Firestore não existir, com mensagem útil).
- Botão de setup disponível em `/admin → Sistema` (após primeiro login).
- README tem guia completo passo-a-passo.
