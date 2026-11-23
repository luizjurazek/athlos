---
description: Idioma do código (inglês) e da interface (pt-BR)
---

# Idiomas

## Código em inglês
- Variáveis, funções, componentes, tipos: `getUser`, `LoginForm`, `AuthUser`.
- Rotas e arquivos: `/forgot-password`, `reset-password/page.tsx`.
- Banco: tabelas e colunas em inglês snake_case (`full_name`, `created_at`).
- Comentários (quando existirem) em inglês.

## Interface em pt-BR
- Labels, botões, placeholders: `"Entrar"`, `"Criar conta"`, `"Esqueci a senha"`.
- Mensagens de erro/sucesso exibidas ao usuário: `"Email ou senha inválidos."`.

## Nunca misturar
- ❌ `const nomeUsuario = ...` / ❌ `"Invalid email"` na tela
- ✅ `const userName = ...` / ✅ `"Email inválido."`
