---
description: Princípios gerais de implementação do athlos
paths:
  - "app/**/*.ts"
  - "app/**/*.tsx"
  - "utils/**/*.ts"
  - "proxy.ts"
---

# Princípios

## Sempre
- Copie o padrão do arquivo irmão mais recente (ex.: nova tela de auth → `app/(auth)/login`).
- Leia o guia em `node_modules/next/dist/docs/` antes de usar API do Next que você não viu neste projeto.
- Server Components por padrão; `"use client"` só no componente que precisa de estado/evento.
- Mutação via Server Action (`"use server"`), revalidando o usuário dentro da action.
- Exports nomeados para componentes reutilizáveis; `export default` só onde o Next exige (page, layout, route).

## Nunca
- Adicionar dependência sem aprovação (inclui Tailwind, libs de UI, libs de form).
- Usar `any` ou `as` para silenciar tipo — use `unknown` + narrowing.
- Ler segredo no cliente: só `NEXT_PUBLIC_*` vai para o browser; a `service_role` key nunca.
