-- Entrada de uso de apps vinda de fora (Atalhos do iPhone, ActivityWatch), protegida por token
create table tokens_uso (
  token text primary key default encode(gen_random_bytes(24), 'hex'),
  user_id uuid not null references auth.users default auth.uid(),
  criado_em timestamptz default now()
);
alter table tokens_uso enable row level security;
create policy dono on tokens_uso for select using (user_id = (select auth.uid()));

create unique index uso_apps_unico on uso_apps (user_id, dispositivo, app, inicio);

create or replace function public.registrar_uso(p_token text, p_registros jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare u uuid; n integer;
begin
  select user_id into u from tokens_uso where token = p_token;
  if u is null then raise exception 'token inválido'; end if;
  if jsonb_typeof(p_registros) <> 'array' or jsonb_array_length(p_registros) > 2000 then raise exception 'registros inválidos'; end if;
  insert into uso_apps (user_id, dispositivo, app, site, inicio, duracao_seg, classe)
  select u, left(r->>'dispositivo', 40), left(r->>'app', 120), left(r->>'site', 200),
         coalesce((r->>'inicio')::timestamptz, now()), nullif(r->>'duracao_seg','')::int, left(r->>'classe', 20)
  from jsonb_array_elements(p_registros) r
  where coalesce(r->>'app','') <> '' and coalesce(r->>'dispositivo','') <> ''
  on conflict (user_id, dispositivo, app, inicio) do update set duracao_seg = excluded.duracao_seg, site = excluded.site;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.registrar_uso(text, jsonb) from public;
grant execute on function public.registrar_uso(text, jsonb) to anon, authenticated;
-- O token do dono é criado à parte: insert into tokens_uso (user_id) values ('<uuid do usuário>');
