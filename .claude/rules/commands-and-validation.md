---
description: Scripts do projeto, validação mínima, e como lidar com dev server e processos
---

# Comandos e validação

## Scripts (`package.json`)
- `npm run dev` — `next dev` na porta 3000.
- `npm run build` — build de produção; pega erros de prerender do Cache Components que o `tsc` não pega.
- `npm run lint` — eslint.
- `npx tsc --noEmit` — type-check. Tipos de rota (`PageProps<"/rota">`) só existem depois de um `build`/`dev`.

## Validação
- Mudança pequena/pontual: `npx tsc --noEmit` + `npm run build` + leitura do diff. Sem navegador.
- Fluxo novo ou risco real de regressão visual: avise o risco e **pergunte** antes de testar no navegador.

## Dev server e processos
- Antes de subir servidor, verifique se a porta já responde (`curl -sf http://localhost:3000`).
  Se responder, use essa instância; não reinicie nem suba outra.
- Nunca use `pkill -f`/`killall` por nome. Se precisar de um servidor próprio, use outra porta,
  guarde o PID e mate só esse PID.
