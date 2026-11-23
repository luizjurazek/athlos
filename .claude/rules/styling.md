---
description: Estilo com CSS Modules e tokens de cor light/dark de app/theme.css
paths:
  - "app/**/*.css"
  - "app/**/*.tsx"
---

# Estilo

- **Sem Tailwind** e sem libs de UI/CSS-in-JS. Use CSS Modules (`*.module.css` ao lado do componente).
- Estilos globais só em `app/globals.css` (reset, `body`); tokens só em `app/theme.css`.

## Paleta
- **Monocromática:** preto e branco dominam. Primitivas em `theme.css`: `#FFFFFF`/`#F5F5F7` (brancos),
  `#1D1D1F`/`#0A0A0A` (pretos), `#FC6E20` (laranja, acento) e `#132238` (navy, só na logo).
  Componentes nunca usam `--palette-*` direto, só `--color-*`.
- Claro: fundo branco, superfícies `#F5F5F7`, texto `#1D1D1F`. Escuro: fundo `#0A0A0A`,
  superfícies `#1C1C1E`, texto `#F5F5F7`. Cinzas no estilo iOS para texto secundário e bordas.
- **Botão principal é monocromático e invertido:** preto com texto branco no claro, branco com texto
  preto no escuro (`--color-primary` / `--color-on-primary`).
- **Links:** cor do texto, peso 600 e sublinhado discreto — não use cor para destacar link.
- **Laranja é acento pequeno:** foco (`--color-focus`), destaques pontuais, badges (`--color-accent*`).
  Nunca como fundo de áreas grandes nem em vários elementos da mesma tela. Como texto no claro, use
  `--color-accent-text` (laranja puro sobre branco não passa em contraste).
- **Navy só na identidade (logo).** Não use em UI.
- Cor nova: confira contraste ≥ 4.5:1 para texto nos dois temas antes de criar o token.

## Cores
- Use **apenas** os tokens semânticos de `app/theme.css` (`--color-bg`, `--color-surface`,
  `--color-text`, `--color-text-muted`, `--color-border`, `--color-primary`, `--color-danger`, …).
- Nunca escreva cor fixa (`#hex`, `rgb()`, `rgba()`) em componente. Precisa de uma cor nova?
  Adicione um token em `theme.css` com `light-dark(<claro>, <escuro>)`.
- Variações translúcidas: `color-mix(in srgb, var(--color-x) 12%, transparent)` no próprio `theme.css`.

## Tema
- Padrão segue o sistema (`color-scheme: light dark`). `<html data-theme="light|dark">` força um tema —
  é o ponto de integração da futura tela de Settings.
