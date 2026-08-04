-- Pontes security definer para o Vault, chamadas so pela edge function
-- projte-manage-secret (via service_role). O schema "vault" nao e exposto
-- via PostgREST, entao nao da pra chamar vault.create_secret/update_secret
-- direto por .rpc() -- essas funcoes vivem em projte_config (que ja e
-- exposto) e usam security definer pra ganhar acesso ao vault internamente.

create or replace function projte_config.vault_create_secret(new_secret text, new_name text, new_description text default '')
returns uuid
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  result uuid;
begin
  result := vault.create_secret(new_secret, new_name, new_description);
  return result;
end;
$$;

create or replace function projte_config.vault_update_secret(secret_id uuid, new_secret text)
returns void
language plpgsql
security definer
set search_path = vault, public
as $$
begin
  perform vault.update_secret(secret_id, new_secret);
end;
$$;

create or replace function projte_config.vault_delete_secret(secret_id uuid)
returns void
language sql
security definer
set search_path = vault, public
as $$
  delete from vault.secrets where id = secret_id;
$$;

revoke all on function projte_config.vault_create_secret(text,text,text) from public, authenticated, anon;
revoke all on function projte_config.vault_update_secret(uuid,text) from public, authenticated, anon;
revoke all on function projte_config.vault_delete_secret(uuid) from public, authenticated, anon;

grant execute on function projte_config.vault_create_secret(text,text,text) to service_role;
grant execute on function projte_config.vault_update_secret(uuid,text) to service_role;
grant execute on function projte_config.vault_delete_secret(uuid) to service_role;
