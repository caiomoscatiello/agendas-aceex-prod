
ALTER TABLE projetos
  ADD COLUMN IF NOT EXISTS monday_board_id   TEXT,
  ADD COLUMN IF NOT EXISTS monday_board_url  TEXT,
  ADD COLUMN IF NOT EXISTS monday_status     TEXT DEFAULT 'nao_criado';

ALTER TABLE projeto_atividades
  ADD COLUMN IF NOT EXISTS monday_group_id   TEXT;

ALTER TABLE agendas
  ADD COLUMN IF NOT EXISTS monday_item_id         TEXT,
  ADD COLUMN IF NOT EXISTS doc_referencia         TEXT,
  ADD COLUMN IF NOT EXISTS doc_status             TEXT DEFAULT 'nao_exigido',
  ADD COLUMN IF NOT EXISTS autentique_envelope_id TEXT;
