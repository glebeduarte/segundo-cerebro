-- Notas: tags e data de edição
alter table itens add column tags text[] not null default '{}';
alter table itens add column atualizado_em timestamptz not null default now();
create index itens_tags on itens using gin (tags);
create index itens_notas on itens (user_id, tipo, atualizado_em desc);
