
-- 1. Adicionar datas em projeto_atividades
ALTER TABLE projeto_atividades
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date;

-- 2. Adicionar datas em cronograma_itens
ALTER TABLE cronograma_itens
  ADD COLUMN IF NOT EXISTS data_inicio date,
  ADD COLUMN IF NOT EXISTS data_fim date;

-- 3. Criar tabela projeto_stakeholders
CREATE TABLE IF NOT EXISTS projeto_stakeholders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  nome text NOT NULL,
  cargo text,
  departamento text,
  empresa text,
  nivel_hierarquico text,
  tipo text NOT NULL DEFAULT 'Externo',
  email text,
  telefone text,
  tipo_influencia text NOT NULL DEFAULT 'Neutro',
  interesses text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projeto_stakeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam stakeholders"
  ON projeto_stakeholders FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 4. Criar tabela projeto_riscos
CREATE TABLE IF NOT EXISTS projeto_riscos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  responsavel_id uuid REFERENCES projeto_stakeholders(id) ON DELETE SET NULL,
  descricao text NOT NULL,
  probabilidade text NOT NULL DEFAULT 'Média',
  impacto text NOT NULL DEFAULT 'Médio',
  status text NOT NULL DEFAULT 'Identificado',
  acao_mitigadora text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE projeto_riscos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam riscos"
  ON projeto_riscos FOR ALL
  USING (auth.uid() IS NOT NULL);
