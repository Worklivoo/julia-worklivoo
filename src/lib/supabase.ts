import { createClient } from '@supabase/supabase-js'

// Usando variáveis de ambiente para maior segurança
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Verificação de segurança para garantir que as variáveis estão definidas
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não foram configuradas corretamente')
}

// Configuração do cliente Supabase
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Desabilita refresh automático ao ganhar foco da janela
    flowType: 'pkce'
  },
  // Configurações globais para reduzir atualizações desnecessárias
  global: {
    headers: {
      'x-client-info': 'supabase-js-web',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`
    }
  }
})

// Tipos para as tabelas do Supabase
export interface Database {
  public: {
    Tables: {
      membros: {
        Row: {
          membro_id: string
          user_id: string
          created_at: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Insert: {
          membro_id?: string
          user_id: string
          created_at?: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Update: {
          membro_id?: string
          user_id?: string
          created_at?: string
          membro_nome?: string
          membro_email?: string
          membro_cargo?: 'Administrador' | 'Usuario'
          membro_status?: 'Ativo' | 'Desativado'
        }
      }
      membros_v2: {
        Row: {
          membro_id: string
          user_id: string
          membro_nome: string
          membro_telefone: string | null
          membro_email: string
          membro_tipo: 'Administrador' | 'Usuario'
          membro_status: 'Ativado' | 'Desativado'
          nova_atualizacao: boolean | null
        }
        Insert: {
          membro_id?: string
          user_id: string
          membro_nome: string
          membro_telefone?: string | null
          membro_email: string
          membro_tipo: 'Administrador' | 'Usuario'
          membro_status?: 'Ativado' | 'Desativado'
          nova_atualizacao?: boolean | null
        }
        Update: {
          membro_id?: string
          user_id?: string
          membro_nome?: string
          membro_telefone?: string | null
          membro_email?: string
          membro_tipo?: 'Administrador' | 'Usuario'
          membro_status?: 'Ativado' | 'Desativado'
          nova_atualizacao?: boolean | null
        }
      }
      usuarios: {
          Row: {
            user_id: string
            user_nome: string
            user_email: string
            user_telefone: string | null
            user_empresa: string | null
            user_plano: string | null
            user_quantidade_leads?: number | null
            cliente_status?: string | null
            user_valor_mensal: string | null
            id_instancia_zapi: string | null
            token_instancia_zapi: string | null
            token_instancia_uazapi: string | null
            user_tipo: string | null
            conhecimento_id: string | null
            documento_id: string | null
            prompt: string | null
            scrapper_tipo: string | null
            scrapper_link: string | null
            scrapper_body: string | null
            id_cliente_asaas: string | null
            cartao_token: string | null
            cartao_final: string | null
            dia_vencimento: number | null
          }
          Insert: {
            user_id: string
            user_nome: string
            user_email: string
            user_telefone?: string | null
            user_empresa?: string | null
            user_plano?: string | null
            user_quantidade_leads?: number | null
            cliente_status?: string | null
            user_valor_mensal?: string | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            token_instancia_uazapi?: string | null
            user_tipo?: string | null
            conhecimento_id?: string | null
            documento_id?: string | null
            prompt?: string | null
            scrapper_tipo?: string | null
            scrapper_link?: string | null
            scrapper_body?: string | null
            id_cliente_asaas?: string | null
            cartao_token?: string | null
            cartao_final?: string | null
            dia_vencimento?: number | null
          }
          Update: {
            user_id?: string
            user_nome?: string
            user_email?: string
            user_telefone?: string | null
            user_empresa?: string | null
            user_plano?: string | null
            user_quantidade_leads?: number | null
            cliente_status?: string | null
            user_valor_mensal?: string | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            token_instancia_uazapi?: string | null
            user_tipo?: string | null
            conhecimento_id?: string | null
            documento_id?: string | null
            prompt?: string | null
            scrapper_tipo?: string | null
            scrapper_link?: string | null
            scrapper_body?: string | null
            id_cliente_asaas?: string | null
            cartao_token?: string | null
            cartao_final?: string | null
            dia_vencimento?: number | null
          }
      },
      usuarios_v2: {
          Row: {
            user_id: string
            user_nome: string
            user_email: string
            email_alias: string | null
            user_telefone: string | null
            user_empresa: string | null
            user_cnpj: string | null
            user_plano: string | null
            user_quantidade_leads: number | null
            plano_ciclo: string | null
            user_valor_mensal: string | number | null
            plano_status: string | null
            cliente_status: string | null
            aceite_termos_at: string | null
            nps_data_envio: string | null
            nps_suporte: number | null
            nps_ia: number | null
            nps_padrao: number | null
            id_instancia_zapi: string | null
            token_instancia_zapi: string | null
            token_instancia_uazapi: string | null
            grupo_whatsapp_id: string | null
            mensagem_saudacao_portal: string | null
            id_mensagem_saudacao_api_oficial_whatsapp: string | null
            frequencia_followup: number | null
            quantidade_maxima_followup: number | null
            transbordo_followup_status: boolean | null
            transbordo_followup_etapas: string | null
            transbordo_followup_metodo: string | null
            transbordo_followup_telefones: string | null
            google_avaliacao: boolean | null
            google_link_avaliacao: string | null
            recomendar_api_oficial: boolean | null
            api_oficial: boolean | null
            id_api_whatsapp: string | null
            salvy_id: string | null
            waba_id: string | null
            user_tipo: string | null
            conhecimento_id: string | null
            documento_id: string | null
            prompt: string | null
            scrapper_tipo: string | null
            scrapper_link: string | null
            scrapper_body: string | null
            telefone_qualificado: string | null
            modo_qualificacao: string | null
            leads_whatsapp: string | null
            id_cliente_asaas: string | null
            cartao_token: string | null
            cartao_final: string | null
            dia_vencimento: number | null
          }
          Insert: {
            user_id: string
            user_nome: string
            user_email: string
            email_alias?: string | null
            user_telefone?: string | null
            user_empresa?: string | null
            user_cnpj?: string | null
            user_plano?: string | null
            user_quantidade_leads?: number | null
            plano_ciclo?: string | null
            user_valor_mensal?: string | number | null
            plano_status?: string | null
            cliente_status?: string | null
            aceite_termos_at?: string | null
            nps_data_envio?: string | null
            nps_suporte?: number | null
            nps_ia?: number | null
            nps_padrao?: number | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            token_instancia_uazapi?: string | null
            grupo_whatsapp_id?: string | null
            mensagem_saudacao_portal?: string | null
            id_mensagem_saudacao_api_oficial_whatsapp?: string | null
            frequencia_followup?: number | null
            quantidade_maxima_followup?: number | null
            transbordo_followup_status?: boolean | null
            transbordo_followup_etapas?: string | null
            transbordo_followup_metodo?: string | null
            transbordo_followup_telefones?: string | null
            google_avaliacao?: boolean | null
            google_link_avaliacao?: string | null
            recomendar_api_oficial?: boolean | null
            api_oficial?: boolean | null
            id_api_whatsapp?: string | null
            salvy_id?: string | null
            waba_id?: string | null
            user_tipo?: string | null
            conhecimento_id?: string | null
            documento_id?: string | null
            prompt?: string | null
            scrapper_tipo?: string | null
            scrapper_link?: string | null
            scrapper_body?: string | null
            telefone_qualificado?: string | null
            modo_qualificacao?: string | null
            leads_whatsapp?: string | null
            id_cliente_asaas?: string | null
            cartao_token?: string | null
            cartao_final?: string | null
            dia_vencimento?: number | null
          }
          Update: {
            user_id?: string
            user_nome?: string
            user_email?: string
            email_alias?: string | null
            user_telefone?: string | null
            user_empresa?: string | null
            user_cnpj?: string | null
            user_plano?: string | null
            user_quantidade_leads?: number | null
            plano_ciclo?: string | null
            user_valor_mensal?: string | number | null
            plano_status?: string | null
            cliente_status?: string | null
            aceite_termos_at?: string | null
            nps_data_envio?: string | null
            nps_suporte?: number | null
            nps_ia?: number | null
            nps_padrao?: number | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            token_instancia_uazapi?: string | null
            grupo_whatsapp_id?: string | null
            mensagem_saudacao_portal?: string | null
            id_mensagem_saudacao_api_oficial_whatsapp?: string | null
            frequencia_followup?: number | null
            quantidade_maxima_followup?: number | null
            transbordo_followup_status?: boolean | null
            transbordo_followup_etapas?: string | null
            transbordo_followup_metodo?: string | null
            transbordo_followup_telefones?: string | null
            google_avaliacao?: boolean | null
            google_link_avaliacao?: string | null
            recomendar_api_oficial?: boolean | null
            api_oficial?: boolean | null
            id_api_whatsapp?: string | null
            salvy_id?: string | null
            waba_id?: string | null
            user_tipo?: string | null
            conhecimento_id?: string | null
            documento_id?: string | null
            prompt?: string | null
            scrapper_tipo?: string | null
            scrapper_link?: string | null
            scrapper_body?: string | null
            telefone_qualificado?: string | null
            modo_qualificacao?: string | null
            leads_whatsapp?: string | null
            id_cliente_asaas?: string | null
            cartao_token?: string | null
            cartao_final?: string | null
            dia_vencimento?: number | null
          }
      },
      base_conhecimento_v2: {
        Row: {
          conhecimento_id: number
          user_id: string
          pergunta: string
          resposta: string
          criado_em: string
          ativo_inativo: boolean | null
        }
        Insert: {
          conhecimento_id?: number
          user_id: string
          pergunta: string
          resposta: string
          criado_em?: string
          ativo_inativo?: boolean | null
        }
        Update: {
          conhecimento_id?: number
          user_id?: string
          pergunta?: string
          resposta?: string
          criado_em?: string
          ativo_inativo?: boolean | null
        }
      },
      leads: {
        Row: {
          lead_id: number
          created_at: string
          updated_at: string
          lead_etapa: string
          lead_status: string
          lead_nome_pessoa: string
          lead_empresa: string
          lead_telefone: string
          lead_email: string
          lead_canal_origem: string
          lead_notas: string
          user_id: string
          lead_nome_oportunidade: string
          thread_dify: string | null
          ativo_fluxo_cadencia: string | null
          etapa_fluxo_followup: string | null
          ativo_ia: string | null
          membro_id: string | null
        }
        Insert: {
          lead_id?: number
          created_at?: string
          updated_at?: string
          lead_etapa: string
          lead_status: string
          lead_nome_pessoa: string
          lead_empresa: string
          lead_telefone: string
          lead_email: string
          lead_canal_origem: string
          lead_notas: string
          user_id: string
          lead_nome_oportunidade: string
          thread_dify?: string | null
          ativo_fluxo_cadencia?: string | null
          etapa_fluxo_followup?: string | null
          ativo_ia?: string | null
          membro_id?: string | null
        }
        Update: {
          lead_id?: number
          created_at?: string
          updated_at?: string
          lead_etapa?: string
          lead_status?: string
          lead_nome_pessoa?: string
          lead_empresa?: string
          lead_telefone?: string
          lead_email?: string
          lead_canal_origem?: string
          lead_notas?: string
          user_id?: string
          lead_nome_oportunidade?: string
          thread_dify?: string | null
          ativo_fluxo_cadencia?: string | null
          etapa_fluxo_followup?: string | null
          ativo_ia?: string | null
          membro_id?: string | null
        }
      }
      leads_historico: {
        Row: {
          historico_id: number
          created_at: string
          lead_id: number
          historico_lead: string
        }
        Insert: {
          historico_id?: number
          created_at?: string
          lead_id: number
          historico_lead: string
        }
        Update: {
          historico_id?: number
          created_at?: string
          lead_id?: number
          historico_lead?: string
        }
      }
      clientes_pagamento: {
        Row: {
          id: string
          user_id: string
          id_cliente_asaas: string
          id_cobranca_asaas: string | null
          valor_total: number
          data_vencimento: string
          status_pagamento: string | null
          url_fatura: string | null
          url_comprovante: string | null
          cartao_token: string | null
          cartao_final: string | null
          cartao_bandeira: string | null
          data_criacao: string
          data_pagamento: string | null
        }
        Insert: {
          id?: string
          user_id: string
          id_cliente_asaas: string
          id_cobranca_asaas?: string | null
          valor_total: number
          data_vencimento: string
          status_pagamento?: string | null
          url_fatura?: string | null
          url_comprovante?: string | null
          cartao_token?: string | null
          cartao_final?: string | null
          cartao_bandeira?: string | null
          data_criacao?: string
          data_pagamento?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          id_cliente_asaas?: string
          id_cobranca_asaas?: string | null
          valor_total?: number
          data_vencimento?: string
          status_pagamento?: string | null
          url_fatura?: string | null
          url_comprovante?: string | null
          cartao_token?: string | null
          cartao_final?: string | null
          cartao_bandeira?: string | null
          data_criacao?: string
          data_pagamento?: string | null
        }
      },
      feedbacks: {
        Row: {
          feedback_id: number
          criado_em: string
          user_id: string
          mensagem_id: string
          comentario_tipo: string
          comentario_mensagem: string | null
          dify_conversation: string
          dify_user: string
          status: string | null
        }
        Insert: {
          feedback_id?: number
          criado_em?: string
          user_id: string
          mensagem_id: string
          comentario_tipo: string
          comentario_mensagem?: string | null
          dify_conversation: string
          dify_user: string
          status?: string | null
        }
        Update: {
          feedback_id?: number
          criado_em?: string
          user_id?: string
          mensagem_id?: string
          comentario_tipo?: string
          comentario_mensagem?: string | null
          dify_conversation?: string
          dify_user?: string
          status?: string | null
        }
      }
    }
  }
}
