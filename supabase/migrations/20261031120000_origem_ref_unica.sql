-- Evita importar a mesma reunião ou conversa duas vezes
create unique index itens_origem_ref_unica on itens (user_id, origem_ref) where origem_ref is not null;
