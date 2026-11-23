# Athlos Agents Guide

Índice canônico das instruções de IA do athlos. `CLAUDE.md` só importa este arquivo.

## Como usar

1. Leia este arquivo para saber onde cada coisa mora e qual rule vale para o que você vai tocar.
2. As rules vivem em `.claude/rules/*.md` e são citadas **pelo nome**; o Claude Code carrega o corpo
   sozinho pelo frontmatter `paths:` (rule sem `paths:` é sempre carregada). Não anexe rule por `@`.
3. Não invente padrão novo quando já houver um no projeto: copie o arquivo irmão mais recente.
4. Valide comandos contra o `package.json` real antes de citá-los.

## Stack

- Next.js 16.4 (App Router, `cacheComponents` e `partialPrefetching` ligados), React 19, TypeScript.
- Supabase (`@supabase/ssr`) para auth e banco; sessão renovada em `proxy.ts`.
- CSS Modules + tokens de cor em `app/theme.css`. **Sem Tailwind.**

## Mapa do projeto

| O quê | Onde |
|---|---|
| Proxy (antigo middleware) | `proxy.ts` → `utils/supabase/proxy.ts` (`updateSession`, rotas protegidas) |
| Clientes Supabase | `utils/supabase/server.ts`, `client.ts` |
| Usuário no servidor | `utils/supabase/user.ts` (`getUser`, `requireUser`) |
| Telas e actions de auth | `app/(auth)/` (`actions.ts`, `forms.tsx`, páginas) |
| Callback de email | `app/auth/confirm/route.ts` |
| Área logada | `app/dashboard/` |
| Tokens de cor (light/dark) | `app/theme.css` |
| Migrations | `supabase/migrations/` |

## Rules

### Sempre

- `idiom-definitions` — código em inglês, interface em pt-BR.
- `comments` — nomes descritivos primeiro; comentário só para o porquê não óbvio, em inglês.
- `commands-and-validation` — scripts, validação mínima e regras de processos/portas.

### Por tarefa

- `core-principles` — sem dependência nova, sem `any`, copiar padrões existentes; `app/**`, `utils/**`, `proxy.ts`.
- `nextjs` — particularidades do Next 16 (proxy, Cache Components, Suspense, `connection()`).
- `supabase-auth` — `getClaims()` no servidor, Server Actions, proxy e callback de email.
- `styling` — CSS Modules e tokens de `theme.css`; nada de cor fixa nem Tailwind.
- `migrations` — SQL em `supabase/migrations`: RLS sempre, `security definer` com `search_path = ''`.

## Comandos

```bash
npm run dev     # next dev (porta 3000) — verifique antes se já não está rodando
npm run build   # valida tipos + prerender do Cache Components
npm run lint    # eslint
npx tsc --noEmit
```

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
