-- 4a ponte security definer para o Vault (complementa as 3 da migration
-- 20260804190100). As anteriores cobrem criar/rotacionar/remover; esta
-- cobre LER o valor real do segredo, necessária pro botão "Criar Ambiente"
-- (provisionamento automático) poder recuperar o management_token guardado
-- no Vault e usá-lo pra chamar a Supabase Management API do projeto do
-- cliente. Só service_role pode executar -- nunca authenticated/anon.
--
-- Le de vault.decrypted_secrets (view que já vem com o valor decriptado
-- pela extensão supabase_vault), não de vault.secrets (que só tem o
-- ciphertext).

create or replace function projte_config.vault_reveal_secret(secret_id uuid)
returns text
language sql
security definer
set search_path = vault, public
as $$
  select decrypted_secret from vault.decrypted_secrets where id = secret_id;
$$;

revoke all on function projte_config.vault_reveal_secret(uuid) from public, authenticated, anon;
grant execute on function projte_config.vault_reveal_secret(uuid) to service_role;
