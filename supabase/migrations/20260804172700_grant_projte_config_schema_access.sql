-- Grants necessarios para o PostgREST conseguir servir o schema projte_config
-- (RLS restringe linhas, mas sem esses grants de schema/tabela o Postgres nem deixa
-- o role 'authenticated' tentar). Precisa também marcar o schema como exposto em
-- Project Settings -> API -> Data API -> Exposed schemas (passo manual no dashboard,
-- não hà API/SQL equivalente confiável no Supabase hospedado).

grant usage on schema projte_config to authenticated, service_role;

grant select, insert, update, delete on all tables in schema projte_config to authenticated;
grant all on all tables in schema projte_config to service_role;

alter default privileges in schema projte_config
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema projte_config
  grant all on tables to service_role;

grant usage, select on all sequences in schema projte_config to authenticated, service_role;
alter default privileges in schema projte_config
  grant usage, select on sequences to authenticated, service_role;
