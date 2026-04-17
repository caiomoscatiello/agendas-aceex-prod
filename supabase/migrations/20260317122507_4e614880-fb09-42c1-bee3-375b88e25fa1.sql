ALTER TABLE requisicoes_agenda
  ADD COLUMN IF NOT EXISTS descricao_atividade text,
  ADD COLUMN IF NOT EXISTS justificativa text;