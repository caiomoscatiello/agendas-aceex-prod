export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendas: {
        Row: {
          atividade: string
          atividade_descricao: string | null
          autentique_envelope_id: string | null
          cliente: string
          codigo_atividade: string | null
          codigo_cliente: string | null
          codigo_consultor: string | null
          created_at: string
          data: string
          doc_referencia: string | null
          doc_status: string | null
          email: string
          flag_integracao: string
          id: string
          item_cronograma: string | null
          monday_item_id: string | null
          status: string
          user_id: string
          usuario: string
        }
        Insert: {
          atividade: string
          atividade_descricao?: string | null
          autentique_envelope_id?: string | null
          cliente: string
          codigo_atividade?: string | null
          codigo_cliente?: string | null
          codigo_consultor?: string | null
          created_at?: string
          data: string
          doc_referencia?: string | null
          doc_status?: string | null
          email: string
          flag_integracao?: string
          id?: string
          item_cronograma?: string | null
          monday_item_id?: string | null
          status?: string
          user_id: string
          usuario: string
        }
        Update: {
          atividade?: string
          atividade_descricao?: string | null
          autentique_envelope_id?: string | null
          cliente?: string
          codigo_atividade?: string | null
          codigo_cliente?: string | null
          codigo_consultor?: string | null
          created_at?: string
          data?: string
          doc_referencia?: string | null
          doc_status?: string | null
          email?: string
          flag_integracao?: string
          id?: string
          item_cronograma?: string | null
          monday_item_id?: string | null
          status?: string
          user_id?: string
          usuario?: string
        }
        Relationships: []
      }
      apontamento_atividades: {
        Row: {
          agenda_id: string
          atividade_codigo: string
          atividade_descricao: string
          cliente: string
          created_at: string
          data: string
          descricao: string | null
          horas: number
          id: string
          modalidade: string
          percentual_feeling: number | null
          user_id: string
        }
        Insert: {
          agenda_id: string
          atividade_codigo: string
          atividade_descricao: string
          cliente: string
          created_at?: string
          data: string
          descricao?: string | null
          horas?: number
          id?: string
          modalidade?: string
          percentual_feeling?: number | null
          user_id: string
        }
        Update: {
          agenda_id?: string
          atividade_codigo?: string
          atividade_descricao?: string
          cliente?: string
          created_at?: string
          data?: string
          descricao?: string | null
          horas?: number
          id?: string
          modalidade?: string
          percentual_feeling?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "apontamento_atividades_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      apontamentos: {
        Row: {
          cliente: string
          created_at: string
          data: string
          endereco: string | null
          hora: string
          id: string
          latitude: number | null
          longitude: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          cliente: string
          created_at?: string
          data: string
          endereco?: string | null
          hora: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          cliente?: string
          created_at?: string
          data?: string
          endereco?: string | null
          hora?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      cronograma_itens: {
        Row: {
          atividade_id: string
          autentique_envelope_id: string | null
          autentique_status: string | null
          codigo: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string
          doc_exigido: boolean | null
          doc_referencia: string | null
          doc_satisfeito: boolean | null
          doc_satisfeito_em: string | null
          horas_reservadas: number
          id: string
          monday_item_id: string | null
          tipo_documento_id: string | null
          user_id: string
        }
        Insert: {
          atividade_id: string
          autentique_envelope_id?: string | null
          autentique_status?: string | null
          codigo: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao: string
          doc_exigido?: boolean | null
          doc_referencia?: string | null
          doc_satisfeito?: boolean | null
          doc_satisfeito_em?: string | null
          horas_reservadas?: number
          id?: string
          monday_item_id?: string | null
          tipo_documento_id?: string | null
          user_id: string
        }
        Update: {
          atividade_id?: string
          autentique_envelope_id?: string | null
          autentique_status?: string | null
          codigo?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string
          doc_exigido?: boolean | null
          doc_referencia?: string | null
          doc_satisfeito?: boolean | null
          doc_satisfeito_em?: string | null
          horas_reservadas?: number
          id?: string
          monday_item_id?: string | null
          tipo_documento_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_itens_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "projeto_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_itens_tipo_documento_id_fkey"
            columns: ["tipo_documento_id"]
            isOneToOne: false
            referencedRelation: "tipos_documento"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas: {
        Row: {
          cliente: string
          created_at: string
          data_despesa: string
          data_envio_fin: string | null
          data_lancamento: string
          descricao: string
          envio_financeiro: string | null
          foto_url: string | null
          hora_lancamento: string
          id: string
          local_lancamento: string | null
          user_id: string
          valor: number
        }
        Insert: {
          cliente: string
          created_at?: string
          data_despesa: string
          data_envio_fin?: string | null
          data_lancamento: string
          descricao: string
          envio_financeiro?: string | null
          foto_url?: string | null
          hora_lancamento: string
          id?: string
          local_lancamento?: string | null
          user_id: string
          valor: number
        }
        Update: {
          cliente?: string
          created_at?: string
          data_despesa?: string
          data_envio_fin?: string | null
          data_lancamento?: string
          descricao?: string
          envio_financeiro?: string | null
          foto_url?: string | null
          hora_lancamento?: string
          id?: string
          local_lancamento?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          created_at: string
          id: string
          sender_email: string
          sender_name: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_security: string
          smtp_user: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          sender_email?: string
          sender_name?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_security?: string
          smtp_user?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          sender_email?: string
          sender_name?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_security?: string
          smtp_user?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_workflows: {
        Row: {
          ativo: boolean
          codigo: string
          copia: string[]
          corpo_email: string
          created_at: string
          descricao: string
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          codigo: string
          copia?: string[]
          corpo_email?: string
          created_at?: string
          descricao: string
          id?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          codigo?: string
          copia?: string[]
          corpo_email?: string
          created_at?: string
          descricao?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      integration_logs: {
        Row: {
          codigo: string | null
          http_status: number | null
          id: string
          message: string | null
          payload: Json | null
          response: Json | null
          status: string
          timestamp: string
        }
        Insert: {
          codigo?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          payload?: Json | null
          response?: Json | null
          status?: string
          timestamp?: string
        }
        Update: {
          codigo?: string | null
          http_status?: number | null
          id?: string
          message?: string | null
          payload?: Json | null
          response?: Json | null
          status?: string
          timestamp?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          codigo: string | null
          contato: string | null
          created_at: string
          email: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          codigo?: string | null
          contato?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          codigo?: string | null
          contato?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projeto_alertas: {
        Row: {
          created_at: string | null
          detalhe: string | null
          id: string
          projeto_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          status: string | null
          tipo: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          detalhe?: string | null
          id?: string
          projeto_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade: string
          status?: string | null
          tipo: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          detalhe?: string | null
          id?: string
          projeto_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          status?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_alertas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_alertas_resolvido_por_fkey"
            columns: ["resolvido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      projeto_alertas_config: {
        Row: {
          alerta_apontamento_ativo: boolean | null
          alerta_apontamento_dias: number | null
          alerta_consumo_ativo: boolean | null
          alerta_consumo_threshold: number | null
          alerta_feeling_ativo: boolean | null
          alerta_feeling_threshold: number | null
          alerta_parada_ativo: boolean | null
          alerta_parada_dias: number | null
          created_at: string | null
          id: string
          projeto_id: string | null
          updated_at: string | null
        }
        Insert: {
          alerta_apontamento_ativo?: boolean | null
          alerta_apontamento_dias?: number | null
          alerta_consumo_ativo?: boolean | null
          alerta_consumo_threshold?: number | null
          alerta_feeling_ativo?: boolean | null
          alerta_feeling_threshold?: number | null
          alerta_parada_ativo?: boolean | null
          alerta_parada_dias?: number | null
          created_at?: string | null
          id?: string
          projeto_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alerta_apontamento_ativo?: boolean | null
          alerta_apontamento_dias?: number | null
          alerta_consumo_ativo?: boolean | null
          alerta_consumo_threshold?: number | null
          alerta_feeling_ativo?: boolean | null
          alerta_feeling_threshold?: number | null
          alerta_parada_ativo?: boolean | null
          alerta_parada_dias?: number | null
          created_at?: string | null
          id?: string
          projeto_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_alertas_config_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_atividades: {
        Row: {
          codigo: string
          data_fim: string | null
          data_inicio: string | null
          descricao: string
          horas: number
          id: string
          monday_group_id: string | null
          projeto_id: string
        }
        Insert: {
          codigo: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao: string
          horas?: number
          id?: string
          monday_group_id?: string | null
          projeto_id: string
        }
        Update: {
          codigo?: string
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string
          horas?: number
          id?: string
          monday_group_id?: string | null
          projeto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_atividades_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_baseline: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          projeto_id: string
          salvo_por: string | null
          snapshot: Json
          versao: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id: string
          salvo_por?: string | null
          snapshot: Json
          versao?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          projeto_id?: string
          salvo_por?: string | null
          snapshot?: Json
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_baseline_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_despesas: {
        Row: {
          id: string
          projeto_id: string
          tipo_despesa: string
          valor_maximo: number
        }
        Insert: {
          id?: string
          projeto_id: string
          tipo_despesa: string
          valor_maximo?: number
        }
        Update: {
          id?: string
          projeto_id?: string
          tipo_despesa?: string
          valor_maximo?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_despesas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_riscos: {
        Row: {
          acao_mitigadora: string | null
          created_at: string
          descricao: string
          id: string
          impacto: string
          probabilidade: string
          projeto_id: string
          responsavel_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          acao_mitigadora?: string | null
          created_at?: string
          descricao: string
          id?: string
          impacto?: string
          probabilidade?: string
          projeto_id: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          acao_mitigadora?: string | null
          created_at?: string
          descricao?: string
          id?: string
          impacto?: string
          probabilidade?: string
          projeto_id?: string
          responsavel_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_riscos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_riscos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "projeto_stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_stakeholders: {
        Row: {
          cargo: string | null
          created_at: string
          departamento: string | null
          email: string | null
          empresa: string | null
          id: string
          interesses: string | null
          nivel_hierarquico: string | null
          nome: string
          profile_user_id: string | null
          projeto_id: string
          telefone: string | null
          tipo: string
          tipo_influencia: string
          user_id: string
        }
        Insert: {
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          interesses?: string | null
          nivel_hierarquico?: string | null
          nome: string
          profile_user_id?: string | null
          projeto_id: string
          telefone?: string | null
          tipo?: string
          tipo_influencia?: string
          user_id: string
        }
        Update: {
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          empresa?: string | null
          id?: string
          interesses?: string | null
          nivel_hierarquico?: string | null
          nome?: string
          profile_user_id?: string | null
          projeto_id?: string
          telefone?: string | null
          tipo?: string
          tipo_influencia?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_stakeholders_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          autentique_folder_id: string | null
          autentique_folder_url: string | null
          codigo_cliente: string
          contato_nome: string | null
          contato_telefone: string | null
          coordenador_id: string | null
          created_at: string
          deslocamento: number
          email_contato: string | null
          endereco_cliente: string | null
          horas_contratadas: number
          id: string
          monday_board_id: string | null
          monday_board_url: string | null
          monday_status: string | null
          nome_cliente: string
          sharepoint_pasta_url: string | null
          site_cliente: string | null
          status: string
        }
        Insert: {
          autentique_folder_id?: string | null
          autentique_folder_url?: string | null
          codigo_cliente?: string
          contato_nome?: string | null
          contato_telefone?: string | null
          coordenador_id?: string | null
          created_at?: string
          deslocamento?: number
          email_contato?: string | null
          endereco_cliente?: string | null
          horas_contratadas?: number
          id?: string
          monday_board_id?: string | null
          monday_board_url?: string | null
          monday_status?: string | null
          nome_cliente: string
          sharepoint_pasta_url?: string | null
          site_cliente?: string | null
          status?: string
        }
        Update: {
          autentique_folder_id?: string | null
          autentique_folder_url?: string | null
          codigo_cliente?: string
          contato_nome?: string | null
          contato_telefone?: string | null
          coordenador_id?: string | null
          created_at?: string
          deslocamento?: number
          email_contato?: string | null
          endereco_cliente?: string | null
          horas_contratadas?: number
          id?: string
          monday_board_id?: string | null
          monday_board_url?: string | null
          monday_status?: string | null
          nome_cliente?: string
          sharepoint_pasta_url?: string | null
          site_cliente?: string | null
          status?: string
        }
        Relationships: []
      }
      protheus_integracoes: {
        Row: {
          api_key: string
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string
          direcao: string
          endpoint: string
          guia_integracao: string | null
          id: string
          payload_exemplo: Json | null
          updated_at: string
          webhook_path: string
        }
        Insert: {
          api_key?: string
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao: string
          direcao?: string
          endpoint?: string
          guia_integracao?: string | null
          id?: string
          payload_exemplo?: Json | null
          updated_at?: string
          webhook_path?: string
        }
        Update: {
          api_key?: string
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string
          direcao?: string
          endpoint?: string
          guia_integracao?: string | null
          id?: string
          payload_exemplo?: Json | null
          updated_at?: string
          webhook_path?: string
        }
        Relationships: []
      }
      requisicoes_agenda: {
        Row: {
          atividade: string | null
          cliente: string
          coordenador: string
          created_at: string
          data: string
          descricao_atividade: string | null
          id: string
          justificativa: string | null
          modalidade: string
          motivo_rejeicao: string | null
          status: string
          total_horas: number
          user_id: string
        }
        Insert: {
          atividade?: string | null
          cliente: string
          coordenador: string
          created_at?: string
          data: string
          descricao_atividade?: string | null
          id?: string
          justificativa?: string | null
          modalidade?: string
          motivo_rejeicao?: string | null
          status?: string
          total_horas: number
          user_id: string
        }
        Update: {
          atividade?: string | null
          cliente?: string
          coordenador?: string
          created_at?: string
          data?: string
          descricao_atividade?: string | null
          id?: string
          justificativa?: string | null
          modalidade?: string
          motivo_rejeicao?: string | null
          status?: string
          total_horas?: number
          user_id?: string
        }
        Relationships: []
      }
      solicitacoes_cancelamento: {
        Row: {
          agenda_id: string
          created_at: string
          id: string
          justificativa: string
          status: string
          user_id: string
        }
        Insert: {
          agenda_id: string
          created_at?: string
          id?: string
          justificativa: string
          status?: string
          user_id: string
        }
        Update: {
          agenda_id?: string
          created_at?: string
          id?: string
          justificativa?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_cancelamento_agenda_id_fkey"
            columns: ["agenda_id"]
            isOneToOne: false
            referencedRelation: "agendas"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_documento: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          modelo_nome: string | null
          modelo_url: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          modelo_nome?: string | null
          modelo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          modelo_nome?: string | null
          modelo_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "consultor" | "coordenador"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "consultor", "coordenador"],
    },
  },
} as const
