-- Etapa 3: referencias a segredos (Supabase Vault) por ambiente de cliente.
-- NUNCA guardar o valor real da chave/senha aqui -- so o id do vault.secrets
-- correspondente. O valor real e criado via `select vault.create_secret(...)`
-- direto no SQL editor do projeto (nunca colado em chat/log), e so o UUID
-- retornado e registrado nesta tabela.

create table projte_config.ambiente_secrets (
  id uuid primary key default gen_random_uuid(),
  ambiente_id uuid not null references projte_config.ambientes(id) on delete cascade,
  tipo text not null check (tipo in ('service_role_key','anon_key','db_password','management_token','outro')),
  vault_secret_id uuid not null,
  descricao text,
  created_at timestamptz not null default now(),
  unique (ambiente_id, tipo)
);

alter table projte_config.ambiente_secrets enable row level security;

create policy "Autorizados podem tudo em ambiente_secrets" on projte_config.ambiente_secrets
  for all to authenticated using (projte_config.is_authorized()) with check (projte_config.is_authorized());

grant select, insert, update, delete on projte_config.ambiente_secrets to authenticated;
grant all on projte_config.ambiente_secrets to service_role;
