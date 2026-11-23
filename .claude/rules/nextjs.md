---
description: Particularidades do Next.js 16 neste projeto (proxy, Cache Components, Suspense)
paths:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "proxy.ts"
  - "next.config.ts"
---

# Next.js 16

## Proxy, não middleware
- O arquivo é `proxy.ts` na raiz, com `export async function proxy(request)`. `middleware.ts` é obsoleto.
- A lógica fica em `utils/supabase/proxy.ts`; `proxy.ts` só delega e define o `matcher`.

## Cache Components (`cacheComponents: true`)
- Tudo que lê a requisição (`cookies()`, `headers()`, `searchParams`, sessão) precisa estar **dentro de
  `<Suspense>`**. Padrão: a page é síncrona e renderiza o shell; um componente async filho lê a sessão.
  Ver `app/dashboard/page.tsx` e `app/(auth)/login/page.tsx`.
- Nunca faça `await` de sessão no topo de um `layout.tsx` — bloqueia o segmento inteiro.
- `Date.now()`, `Math.random()`, `crypto.randomUUID()` (inclusive dentro de libs, como a checagem de
  expiração do JWT) exigem `await connection()` antes. `getUser()` já faz isso.
- Erros de prerender só aparecem no `npm run build` ou no `next dev` ao abrir a rota.

## Rotas
- `PageProps<"/rota">` e `LayoutProps<"/rota">` são globais gerados; `params`/`searchParams` são Promises.
