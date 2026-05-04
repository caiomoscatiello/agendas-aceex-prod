// src/components/consultor/types/consultor.types.ts

export type Agenda = {
  id: string;
  cliente: string;
  data: string;
  atividade: string;
  status: string;
  atividade_descricao: string | null;
  item_cronograma: string | null;
};

export type Apontamento = {
  id: string;
  data: string;
  hora: string;
  cliente: string;
  tipo: string;
  endereco: string | null;
};

export type ProjetoDespesa = {
  id: string;
  tipo_despesa: string;
  valor_maximo: number;
};

export type Despesa = {
  id: string;
  descricao: string;
  valor: number;
  data_despesa: string;
  envio_financeiro: string | null;
  cliente: string;
};

export type ProjetoAtividade = {
  id: string;
  codigo: string;
  descricao: string;
  horas: number;
  projeto_id: string;
};

export type RequisicaoPendente = {
  id: string;
  data: string;
  cliente: string;
  atividade: string | null;
  total_horas: number;
  modalidade: string;
};

export type AtividadeApontada = {
  atividade_codigo: string;
  atividade_descricao: string;
  horas: number;
  percentual_feeling: number | null;
};

export type RfAgenda = {
  id: string;
  data: string;
  cliente: string;
  status: string;
  horas_apontadas: number;
  horas_planejadas: number;
  deslocamento: number;
};

export type RfDespesa = {
  id: string;
  data: string;
  cliente: string;
  descricao: string;
  status_despesa: string;
  valor: number;
};

export type OffProjeto = {
  id: string;
  nome_cliente: string;
  coordenador_id: string | null;
  deslocamento?: number;
  email_contato?: string | null;
  status?: string;
  monday_board_url?: string | null;
  sharepoint_pasta_url?: string | null;
};

export type CronogramaItemDoc = {
  id: string;
  doc_exigido: boolean;
  doc_satisfeito: boolean;
  codigo: string;
  descricao: string;
  codigo_cliente: string;
  nome_cliente: string;
};

// BL-019 + BL-004-F -- Pendencias PMO
export type TipoPendencia = "doc_pendente" | "apontamento_atrasado" | "requisicao_pendente" | "backlog_vencido";

export type Pendencia = {
  id: string;
  tipo: TipoPendencia;
  cliente: string;
  data: string;
  titulo: string;
  detalhe: string;
  diasEmAberto: number;
  agendaId?: string;
  itemCronograma?: string;
  backlogItemId?: string;
  backlogCodigo?: string;
};
