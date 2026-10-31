-- Segundo Cérebro: esquema inicial
create extension if not exists vector;

create type item_status as enum ('ideia','ativo','pausado','parado','concluido','arquivado');
create type item_tipo as enum ('projeto','area','tarefa','ideia','nota','livro','lazer','reuniao','conversa','recurso');
create type para as enum ('projeto','area','recurso','arquivo');

create table categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  nome text not null,          -- trabalho, família, lazer, estudo, saúde, espiritualidade...
  cor text,
  ordem int default 0
);

create table itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  tipo item_tipo not null,
  para para,
  titulo text not null,
  resumo text,                 -- destilação
  conteudo text,
  status item_status default 'ideia',
  categoria_id uuid references categorias,
  pai_id uuid references itens,  -- tarefa dentro de projeto
  prioridade int,
  prazo date,
  progresso int check (progresso between 0 and 100),
  origem text,                 -- chat_claude, captura, granola, calendar, manual
  origem_ref text,             -- id/URL da conversa ou reunião
  ultimo_movimento timestamptz default now(),
  embedding vector(1024),
  criado_em timestamptz default now()
);

create table conexoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  de_id uuid not null references itens on delete cascade,
  para_id uuid not null references itens on delete cascade,
  relacao text,                -- depende_de, relacionado, gerou, pessoa_envolvida
  unique (de_id, para_id, relacao)
);

create table pessoas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  nome text not null,
  relacao text                 -- cliente, sócio, família, amigo
);

create table item_pessoas (
  item_id uuid references itens on delete cascade,
  pessoa_id uuid references pessoas on delete cascade,
  primary key (item_id, pessoa_id)
);

create table eventos (           -- linha do tempo: tudo que aconteceu
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  item_id uuid references itens on delete set null,
  descricao text not null,
  origem text,
  ocorrido_em timestamptz default now()
);

create table uso_apps (          -- Atalhos do iPhone e ActivityWatch
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users default auth.uid(),
  dispositivo text not null,   -- iphone, computador
  app text not null,
  site text,
  inicio timestamptz not null default now(),
  duracao_seg int,             -- nulo para aberturas do iPhone
  classe text                  -- produtivo, relaxamento, distracao
);

create table briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users default auth.uid(),
  dia date not null,
  texto text not null,
  criado_em timestamptz default now(),
  unique (user_id, dia)
);

-- RLS: cada tabela visível só para o dono
do $$ declare t text;
begin
  foreach t in array array['categorias','itens','conexoes','pessoas','eventos','uso_apps','briefings'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy dono on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
alter table item_pessoas enable row level security;
create policy dono on item_pessoas for all using (
  exists (select 1 from itens i where i.id = item_id and i.user_id = auth.uid()));

-- Itens parados: ativos sem movimento há 14 dias
create view itens_parados as
  select * from itens
  where status = 'ativo' and ultimo_movimento < now() - interval '14 days';
