---
description: Comentários só quando necessários, sempre em inglês
---

# Comentários

- Prefira nomes descritivos e código autoexplicativo a comentários.
- Comente **só o porquê não óbvio**: armadilhas do framework, decisões de segurança, workarounds.
  Ex.: por que `getClaims()` e não `getSession()`, por que `connection()` antes de ler a sessão.
- Nunca comente o *o quê* que o código já diz, nem deixe código comentado.
- Todo comentário em **inglês** (`//`, `/* */`, JSDoc, SQL, CSS), mesmo com o resto em pt-BR.
