-- BL-007 — Health Score Analytics
-- P1: Tabelas projeto_health_config e projeto_health_historico

-- ?? TABELA DE CONFIGURAÇÃO ????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS projeto_health_config (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id           uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,

  -- Pesos das dimensões (somam 100)
  peso_prazo           integer NOT NULL DEFAULT 25,
  peso_custo           integer NOT NULL DEFAULT 25,
  peso_feeling         integer NOT NULL DEFAULT 25,
  peso_alertas         integer NOT NULL DEFAULT 25,

  -- Thresholds IDP
  idp_verde            decimal(4,2) NOT NULL DEFAULT 1.00,
  idp_amarelo          decimal(4,2) NOT NULL DEFAULT 0.80,

  -- Thresholds IDC
  idc_verde            decimal(4,2) NOT NULL DEFAULT 1.00,
  idc_amarelo          decimal(4,2) NOT NULL DEFAULT 0.80,

  -- Thresholds Feeling
  feeling_verde        integer NOT NULL DEFAULT 70,
  feeling_amarelo      integer NOT NULL DEFAULT 50,

  -- Penalidades por alerta
  penalidade_critico   integer NOT NULL DEFAULT 20,
  penalidade_alto      integer NOT NULL DEFAULT 10,
  penalidade_moderado  integer NOT NULL DEFAULT 5,

  -- Thresholds score final
  score_verde          integer NOT NULL DEFAULT 75,
  score_amarelo        integer NOT NULL DEFAULT 50,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_health_config_projeto_id_key UNIQUE (projeto_id),
  CONSTRAINT pesos_somam_100 CHECK (peso_prazo + peso_custo + peso_feeling + peso_alertas = 100),
  CONSTRAINT pesos_range CHECK (
    peso_prazo    BETWEEN 0 AND 50 AND
    peso_custo    BETWEEN 0 AND 50 AND
    peso_feeling  BETWEEN 0 AND 50 AND
    peso_alertas  BETWEEN 0 AND 50
  )
);

-- ?? TABELA DE HISTÓRICO ???????????????????????????????????????????????????????
CREATE TABLE IF NOT EXISTS projeto_health_historico (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id           uuid NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  data_calculo         date NOT NULL,

  -- Score final e por dimensão (0–100)
  score_total          integer NOT NULL DEFAULT 0,
  score_prazo          integer NOT NULL DEFAULT 0,
  score_custo          integer NOT NULL DEFAULT 0,
  score_feeling        integer NOT NULL DEFAULT 0,
  score_alertas        integer NOT NULL DEFAULT 0,

  -- Valores brutos no momento do cálculo
  idp_valor            decimal(5,2) NOT NULL DEFAULT 1.00,
  idc_valor            decimal(5,2) NOT NULL DEFAULT 1.00,
  feeling_medio        decimal(5,2),

  -- Contagem de alertas ativos no momento
  alertas_criticos     integer NOT NULL DEFAULT 0,
  alertas_altos        integer NOT NULL DEFAULT 0,
  alertas_moderados    integer NOT NULL DEFAULT 0,

  -- Semáforo calculado
  semaforo             varchar(10) NOT NULL DEFAULT 'verde'
                       CHECK (semaforo IN ('verde', 'amarelo', 'vermelho')),

  -- Snapshot dos pesos usados
  pesos_snapshot       jsonb NOT NULL DEFAULT '{}',

  created_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT projeto_health_historico_projeto_data_key UNIQUE (projeto_id, data_calculo)
);

-- ?? RLS ???????????????????????????????????????????????????????????????????????
ALTER TABLE projeto_health_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projeto_health_historico ENABLE ROW LEVEL SECURITY;

-- Config: admin vê tudo, coordenador vê só seus projetos
CREATE POLICY "Hierarquia health_config" ON projeto_health_config
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  );

-- Histórico: mesma hierarquia, somente leitura para coordenador
CREATE POLICY "Hierarquia health_historico leitura" ON projeto_health_historico
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
    OR projeto_id IN (SELECT id FROM projetos WHERE coordenador_id = auth.uid())
  );

-- Histórico: apenas service_role escreve (via Edge Function)
CREATE POLICY "Service role escreve historico" ON projeto_health_historico
  FOR INSERT TO service_role
  USING (true)
  WITH CHECK (true);

-- ?? TRIGGER: cria config com defaults ao criar projeto ????????????????????????
CREATE OR REPLACE FUNCTION criar_health_config_padrao()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO projeto_health_config (projeto_id)
  VALUES (NEW.id)
  ON CONFLICT (projeto_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_criar_health_config ON projetos;
CREATE TRIGGER trigger_criar_health_config
  AFTER INSERT ON projetos
  FOR EACH ROW
  EXECUTE FUNCTION criar_health_config_padrao();

-- ?? BACKFILL: criar config para projetos já existentes ????????????????????????
INSERT INTO projeto_health_config (projeto_id)
SELECT id FROM projetos
ON CONFLICT (projeto_id) DO NOTHING;