-- Credencial OAuth do Google para criar eventos na agenda (escopo calendar.events)
create table google_tokens (
  user_id uuid primary key references auth.users default auth.uid(),
  refresh_token text not null,
  conta text,
  atualizado_em timestamptz default now()
);
alter table google_tokens enable row level security;
create policy dono on google_tokens for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
