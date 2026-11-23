---
description: Autenticação com Supabase (SSR) — sessão, proxy, actions e callback de email
paths:
  - "app/utils/supabase/**"
  - "app/(auth)/**"
  - "app/auth/**"
  - "app/dashboard/**"
  - "proxy.ts"
---

# Supabase Auth

## Sessão no servidor
- Use `getUser()` / `requireUser()` de `app/utils/supabase/user.ts`. Eles chamam `getClaims()`, que
  **valida a assinatura** do JWT.
- **Nunca** use `getSession()` no servidor para autorizar algo: ele só decodifica o cookie, que é
  controlado pelo cliente. No browser, `getSession()` serve só para decidir UI.
- Crie o client com `createClient(await cookies())` de `app/utils/supabase/server.ts`.

## Proxy (`app/utils/supabase/proxy.ts`)
- Não coloque código entre `createServerClient` e `getClaims()`; sempre devolva `supabaseResponse`
  (ou um redirect que copie os cookies dele — `redirectWithCookies`).
- `PROTECTED_PREFIXES` usa `startsWith`: **nunca adicione `"/"`** (casa com tudo, inclusive `/login`,
  e gera loop de redirect). A raiz é tratada à parte.
- O proxy é a primeira barreira; a page/action protegida ainda chama `requireUser()`.

## Server Actions (`app/(auth)/actions.ts`)
- Assinatura `(prevState: FormState, formData: FormData)` para uso com `useActionState`.
- Mensagens ao usuário em pt-BR; não vaze se um email existe (reset de senha responde sempre igual).

## Callback de email (`app/auth/confirm/route.ts`)
- Aceita `token_hash` + `type` (`verifyOtp`) e `code` (PKCE, `exchangeCodeForSession`).
- `next` só pode ser path relativo (`safeNext`) — evita open redirect.

## Banco
- Toda leitura de tabela passa por RLS com a chave publishable; não use `service_role` no app.
