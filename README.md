# Segundo cérebro

Painel pessoal de Glebe Duarte, baseado no método CODE. Plano completo em `docs/PRD.md`.

## Stack
Next.js 15 (App Router) · Supabase (Postgres, Auth) · Vercel · Three.js no núcleo animado.

## Rodar localmente
1. Copie `.env.example` para `.env.local` e preencha com a URL e a chave pública do projeto Supabase.
2. Aplique `supabase/migrations/` no projeto (SQL editor ou `supabase db push`).
3. `npm install && npm run dev`

## Login
Link mágico por e-mail. No Supabase, em Authentication > URL Configuration, cadastre a URL da Vercel e `/auth/callback`.
