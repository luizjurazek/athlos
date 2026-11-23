---
description: Linguagem visual inspirada na Apple (HIG) e layout mobile-first, ótimo em mobile e desktop
paths:
  - "app/**/*.tsx"
  - "app/**/*.css"
---

# Design: estilo Apple, mobile-first

**Prioridade sempre mobile.** Toda tela é desenhada e implementada primeiro para ~375px de largura e
depois ampliada para desktop. Uma tela só está pronta se funcionar muito bem nos dois.

## Linguagem visual (inspirada nas Human Interface Guidelines)

- **Clareza e calma:** muito espaço em branco, poucos elementos por tela, uma ação principal clara.
- **Hierarquia pela tipografia**, não por cor ou bordas: tamanho e peso (`--text-*`, 400/500/600/700).
  Títulos grandes no topo da tela (`--text-large-title` no mobile).
- **Superfícies agrupadas** (estilo "inset grouped" do iOS): conteúdo em cards `--color-surface` com
  `--radius-lg`, separadores finos (`1px --color-border`) entre linhas, em vez de bordas pesadas.
- **Cantos arredondados** sempre: controles `--radius-md`, cards `--radius-lg`, sheets/modais
  `--radius-xl`, chips e pílulas `--radius-full`.
- **Profundidade sutil:** sombras leves (`--shadow-sm`/`--shadow-md`); barras fixas com material
  translúcido (`backdrop-filter: saturate(180%) blur(20px)` sobre `color-mix` do fundo).
- **Cor com parcimônia:** laranja só para a ação principal, estado ativo e foco. O resto é neutro.
- **Movimento** curto e natural: `--duration-*` + `--ease-standard` (ou `--ease-spring` para entradas).
  Anime só `transform` e `opacity`. Feedback de toque com `:active { transform: scale(0.97) }`.
  `prefers-reduced-motion` já zera as durações — sempre use os tokens, nunca ms fixos.
- Ícones lineares, traço uniforme, mesmo tamanho óptico do texto ao lado.

## Mobile-first na prática

- **CSS base = mobile.** Ampliações só com `@media (min-width: 640px)` e `@media (min-width: 1024px)`.
  Nunca `max-width` media query para "consertar" o mobile.
- **Alvos de toque ≥ `--touch-target` (44px)** de altura/largura, com `--space-2` entre alvos.
- **Inputs com `font-size` ≥ 16px** (`--text-body`), senão o iOS dá zoom ao focar. Use `type`,
  `inputMode` e `autoComplete` corretos (`email`, `current-password`, `new-password`, `one-time-code`).
- **Zona do polegar:** no mobile, a ação principal fica embaixo (botão largo, `width: 100%`) ou em
  barra fixa inferior; no desktop pode voltar para o fluxo normal.
- **Navegação:** tab bar inferior no mobile; sidebar ou top bar no desktop.
- **Safe areas:** barras fixas usam `env(safe-area-inset-*)` no padding (layout com `viewportFit: "cover"`).
- **Altura:** `100dvh`/`min-height: 100dvh`, nunca `100vh` (quebra com a barra do Safari).
- **Hover é bônus:** estilos de hover dentro de `@media (hover: hover)`; nada pode depender de hover.
- Sem scroll horizontal em 320px. Texto longo quebra (`overflow-wrap: anywhere` em dados do usuário).
- **Desktop:** conteúdo com `max-width` legível (~640px para formulários, ~1100px para páginas) e
  centralizado; aproveite largura com grid de colunas, não esticando componentes.

## Tokens

- Espaçamento só em `--space-*` (grade de 4px), raio em `--radius-*`, tipografia em `--text-*`,
  sombra em `--shadow-*`, movimento em `--duration-*`/`--ease-*` — todos em `app/theme.css`.
- Precisa de valor novo? Crie o token em `theme.css`; não escreva px soltos de espaçamento/raio.

## Antes de dar a tela por pronta

- Confira mentalmente (ou no navegador, se o usuário autorizar) em **375px** e **1280px**, nos temas
  claro e escuro.
- Foco visível em todo elemento interativo (`:focus-visible` com `--color-focus`).
