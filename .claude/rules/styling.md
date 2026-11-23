---
description: Estilo com CSS Modules e tokens de cor light/dark de app/theme.css
paths:
  - "app/**/*.css"
  - "app/**/*.tsx"
---

# Estilo

- **Sem Tailwind** e sem libs de UI/CSS-in-JS. Use CSS Modules (`*.module.css` ao lado do componente).
- Estilos globais só em `app/globals.css` (reset, `body`); tokens só em `app/theme.css`.

## Cores
- Use **apenas** os tokens semânticos de `app/theme.css` (`--color-bg`, `--color-surface`,
  `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-danger`, …).
- Nunca escreva cor fixa (`#hex`, `rgb()`, `rgba()`) em componente. Precisa de uma cor nova?
  Adicione um token em `theme.css` com `light-dark(<claro>, <escuro>)`.
- Variações translúcidas: `color-mix(in srgb, var(--color-x) 12%, transparent)` no próprio `theme.css`.

## Tema
- Padrão segue o sistema (`color-scheme: light dark`). `<html data-theme="light|dark">` força um tema —
  é o ponto de integração da futura tela de Settings.
