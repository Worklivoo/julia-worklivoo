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
      'x-client-info': 'supabase-js-web'
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
      usuarios: {
          Row: {
            user_id: string
            user_nome: string
            user_email: string
            user_telefone: string | null
            user_empresa: string | null
            user_plano: string | null
            id_instancia_zapi: string | null
            token_instancia_zapi: string | null
            user_tipo: string | null
          }
          Insert: {
            user_id: string
            user_nome: string
            user_email: string
            user_telefone?: string | null
            user_empresa?: string | null
            user_plano?: string | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            user_tipo?: string | null
          }
          Update: {
            user_id?: string
            user_nome?: string
            user_email?: string
            user_telefone?: string | null
            user_empresa?: string | null
            user_plano?: string | null
            id_instancia_zapi?: string | null
            token_instancia_zapi?: string | null
            user_tipo?: string | null
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
      teste_fontes_dados: {
        Row: {
          id: number
          created_at: string
          tipo: string | null
          link: string | null
          body: string | null
          cliente: string | null
          user_id: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          tipo?: string | null
          link?: string | null
          body?: string | null
          cliente?: string | null
          user_id?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          tipo?: string | null
          link?: string | null
          body?: string | null
          cliente?: string | null
          user_id?: string | null
        }
      }
    }
  }
}