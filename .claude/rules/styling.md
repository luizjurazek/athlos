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
- Marca: `#1B1B1B` (ink), `#323232` (graphite), `#FFE7D0` (cream), `#FC6E20` (orange) e `#132238` (navy, o azul da logo) — primitivas
  `--palette-*` em `theme.css`. Componentes nunca usam `--palette-*` direto, só `--color-*`.
- Claro: fundo cream, texto ink. Escuro: fundo ink, superfícies graphite, texto cream.
- **Laranja é a única cor interativa (tint color, como no iOS):** botões, links, item ativo, foco,
  toggles. Links usam `--color-primary-text`.
- **Navy é secundária e não interativa:** identidade (logo), badges, gráficos, estados informativos
  (`--color-secondary*`). Nunca em link ou botão — azul frio solto ao lado da paleta quente fica desconectado.
  Nunca como fundo de tela (some sobre ink).
- Laranja é cor de **ação** (fundo de botão, foco). Texto sobre laranja é sempre `--color-on-primary`
  (ink); nunca branco nem cream (contraste < 3:1).
- Laranja como **texto** (links) usa `--color-primary-text`: no claro é um laranja escurecido, porque
  `#FC6E20` sobre cream tem só 2.4:1.
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
