---
description: Migrations SQL do Supabase — RLS, funções e triggers
paths:
  - "supabase/**/*.sql"
---

# Migrations

- Arquivo em `supabase/migrations/<YYYYMMDDHHMMSS>_<descricao_snake_case>.sql`; nunca edite migration já
  aplicada — crie outra.
- Toda tabela em `public` nasce com `enable row level security` e policies explícitas por operação,
  com `to authenticated` e `(select auth.uid())` (não `auth.uid()` puro, por performance).
- Toda tabela nova precisa de `grant` explícito para `authenticated` (só as operações que as policies
  cobrem). Projetos Supabase novos não concedem mais isso sozinhos: sem grant dá `42501 permission
  denied`, mesmo com RLS e policies certas. Nunca conceda a `anon` sem necessidade.
- Chave para usuário: `references auth.users (id) on delete cascade`.
- Funções: `set search_path = ''` e nomes qualificados (`public.tabela`). `security definer` só quando
  necessário, e então `revoke execute ... from public, anon, authenticated`.
- `created_at`/`updated_at` como `timestamptz not null default now()`; `updated_at` via trigger
  `public.set_updated_at()` (já existe).
- Modelo: `supabase/migrations/20261123000000_create_profiles.sql`.
