import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://lnhsqcekgidbbvdiwzzl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuaHNxY2VrZ2lkYmJ2ZGl3enpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODQ1NTYwNSwiZXhwIjoyMDY0MDMxNjA1fQ.TBNkNcH-UUijgyyizCiJVG-P6V2niLo9DI8GMSyoSbY'

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
          membro_id: number
          user_id: string
          created_at: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Insert: {
          membro_id?: number
          user_id: string
          created_at?: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Update: {
          membro_id?: number
          user_id?: string
          created_at?: string
          membro_nome?: string
          membro_email?: string
          membro_cargo?: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status?: 'Ativo' | 'Desativado'
        }
      }
      usuarios: {
        Row: {
          user_id: string
          created_at: string
          user_nome: string
          user_email: string
          user_telefone: string | null
          user_empresa: string | null
          user_avatar: string | null
          user_plano: number | null
        }
        Insert: {
          user_id?: string
          created_at?: string
          user_nome: string
          user_email: string
          user_telefone?: string | null
          user_empresa?: string | null
          user_avatar?: string | null
          user_plano?: number | null
        }
        Update: {
          user_id?: string
          created_at?: string
          user_nome?: string
          user_email?: string
          user_telefone?: string | null
          user_empresa?: string | null
          user_avatar?: string | null
          user_plano?: number | null
        }
      },
      membros: {
        Row: {
          membro_id: number
          user_id: string
          created_at: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Insert: {
          membro_id?: number
          user_id: string
          created_at?: string
          membro_nome: string
          membro_email: string
          membro_cargo: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status: 'Ativo' | 'Desativado'
        }
        Update: {
          membro_id?: number
          user_id?: string
          created_at?: string
          membro_nome?: string
          membro_email?: string
          membro_cargo?: 'Administrador' | 'Corretor' | 'Usuario'
          membro_status?: 'Ativo' | 'Desativado'
        }
      }
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
          membro_id: number | null
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
          membro_id?: number | null
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
          membro_id?: number | null
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
    }
  }
}