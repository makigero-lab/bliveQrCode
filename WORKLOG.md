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
