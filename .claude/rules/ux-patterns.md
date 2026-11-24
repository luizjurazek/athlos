---
description: Padrões de UX e de componentes do Athlos (check, listas, progresso, sheets, formulários, calendário, textos)
paths:
  - "app/**/*.tsx"
  - "app/**/*.css"
---

# Padrões de UX

Padrões aprovados a partir dos mockups do MVP (`projects/Athlos/prototipos/telas-mvp` no Obsidian).
Complementam a rule `design` (linguagem visual) e a `styling` (tokens). Antes de criar um componente
novo, veja se um destes padrões já resolve.

## Significado das cores

Cada cor tem um papel fixo em todas as telas:

- **Verde (`--color-success`):** feito/concluído (check marcado, etapa concluída, dia fechado, "No ritmo").
- **Laranja (`--color-accent*`):** sequência (streak), realocação ("realocado de qua") e o marcador
  de progresso esperado na barra. Fica fora de botões e áreas grandes.
- **Amarelo/âmbar (`--color-warning*`):** pendente ou atrasado ("Faltou qua, 18/11", "Um pouco atrás", viabilidade apertada).
- **Vermelho (`--color-danger*`):** erro de formulário, dia que faltou no calendário e etapa expirada.
- **Cor do objetivo** (`--color-objective-*`): só no badge de ícone do próprio objetivo.
- **Estado nunca só por cor:** sempre junte cor com forma, ícone ou texto (check preenchido +
  texto riscado; contorno vs preenchido; pill com rótulo).

## Listas e check

- Listas no padrão "inset grouped": `--color-surface`, `--radius-lg` e separador de 1px entre linhas.
- Linha com check: **a linha inteira é o alvo** (altura mínima `--touch-target + --space-4`), com o
  círculo de check à esquerda e o badge do objetivo à direita.
- Feito = círculo verde preenchido com ✓, um leve `scale` com `--ease-spring` e o título em
  `--color-text-muted` riscado.
- **Ações secundárias** (mudar de dia, desfazer, editar) ficam num botão ⋯ separado de 44px, nunca no
  toque da linha. Assim o usuário não marca por engano.
- **Check otimista** (`useOptimistic`): marca na hora. Em erro, volta ao estado anterior e mostra a
  mensagem. Contadores e resumos que dependem do check atualizam junto.
- Metadados da linha em `--text-footnote`/muted: dias da semana ("seg a sex", "Todos os dias") e pills de contexto.

## Pills e selos

- Pill = `--radius-full`, texto `--text-caption` com peso strong, fundo `*-bg` translúcido e texto da
  cor do papel. Use para status curtos: ritmo, "realocado de qui", "Expirada", "2 metas".
- O texto da pill é sempre um rótulo legível por si só, sem precisar da cor.

## Progresso

- Barra: trilho `--color-surface-muted` e preenchimento `--color-primary` (verde quando concluída).
- **Progresso esperado** = traço vertical laranja na posição de hoje. Ele mostra o ritmo sem texto extra.
- Sempre acompanhe a barra com números: "**31** de 72" e "faltam 41 em 97 dias" (`tabular-nums`).
- Ritmo com três rótulos fixos: "No ritmo" (verde), "Um pouco atrás" (warning), "Adiantado" (accent).
- Resumo do dia: anel + "x de y" + uma frase do que falta ("Faltam 2 para fechar o dia" ou "Dia fechado").
- Viabilidade e avisos em **linguagem de pessoa**, com os números reais: "Precisa fazer 41 dos 42 dias
  de corrida que restam (≈ 3 por semana)". O aviso é só informativo e não bloqueia a ação.

## Sheets e seletores

- Escolhas contextuais (ex.: mudar de dia) abrem um **sheet inferior** no mobile: grabber,
  cabeçalho com o badge do item e o contexto ("Academia de quarta, 18/11"), botão de fechar, e as
  ações empilhadas em largura total no rodapé.
- **Opção inválida aparece desabilitada e explica o motivo** ("Já tem Academia neste dia"). Ela não
  some, a menos que esteja fora de qualquer janela permitida (ex.: além dos 7 dias de retroativo).
- O botão principal fica desabilitado ("Escolha um dia") até haver seleção e então **diz exatamente o
  que vai acontecer** ("Mudar para sáb, 28/11", "Mudar para sáb, 21/11 e marcar feito").
- Alternar visões irmãs (Ativas / Concluídas / Encerradas) usa segmented control, não abas soltas.

## Formulários

- Label visível sempre acima do campo, nunca só placeholder.
- **Erro junto do campo que causou**: borda `--color-danger` + mensagem com ícone logo abaixo, em
  pt-BR, dizendo como corrigir ("O prazo desta etapa precisa ser depois da etapa anterior."). Nunca só no topo.
- Itens repetíveis (etapas) são **cards empilhados** com número, título e ferramentas (reordenar,
  remover). Logo depois vem um botão tracejado de largura total "Adicionar …".
- Reordenar: arrastar é opcional. Sempre há botões subir/descer como alternativa.
- Atalhos para valores comuns como chips ("em 3 / 6 / 12 meses").
- Form longo no mobile: a ação de salvar fica numa **barra fixa inferior** translúcida, com safe area.
- Multi-select de itens (ex.: objetivos da meta) como lista agrupada com caixa de seleção + badge + meta.

## Datas e calendário

- **Semana começa no domingo** em toda visão semanal ou mensal (RN-17), com o mesmo índice de `app/utils/weekdays.ts`.
- Formato curto: "qua, 18/11". Formato longo no cabeçalho: "Segunda, 23 de novembro". Nada de datas ambíguas.
- Faixa de dias recentes (hoje + 7 anteriores): dia da semana em caption, número grande, hoje
  invertido (`--color-primary`) e um ponto embaixo indicando o estado do dia.
- Calendário: cada estado tem uma forma diferente: feito (preenchido verde), faltou (contorno
  vermelho), programado (contorno neutro), não programado (sem marcação), origem realocada
  (riscada), destino realocado (ponto laranja). **Legenda sempre visível** abaixo do calendário.

## Textos

- Frases curtas e diretas, do ponto de vista do usuário ("Faltou qua, 18/11", "Ainda dá para marcar até 25/11").
- Botões dizem a ação ("Salvar meta", "Mudar de dia", "Marcar feito"), não "OK"/"Confirmar".
- Mostre números concretos em vez de adjetivos ("faltam 58 em 219 dias").

## Layout das telas

- Mobile: título grande + subtítulo de contexto no topo, seções com título em caixa alta muted, a ação
  principal na zona do polegar (botão largo acima da tab bar ou barra fixa).
- Desktop (≥ 1024px): quando a tela tem conteúdo principal + apoio, use duas colunas. Exemplo: em Hoje,
  a lista fica à esquerda e resumo, Pendentes e Metas à direita. Os mesmos componentes, sem versão
  desktop separada.
