export interface Lead {
  id: string;
  opportunityName: string;
  leadName: string;
  email: string;
  phone: string;
  stage: 'entrada' | 'tentando-contato' | 'contato-realizado' | 'qualificada';
  // Status mapeado do Supabase: 'Aberto' -> 'active', 'Perdido' -> 'lost', 'Ganho' -> 'won'
  status: 'active' | 'won' | 'lost';
  createdAt: Date;
  updatedAt: Date;
  source: string;
  value: number;
  notes: Note[];
  priority: 'low' | 'medium' | 'high';
  expectedCloseDate?: Date;
  lead_notas?: string;
  thread_dify?: string;
  ativo_ia?: string;
  membro_id?: string | null;
}

export interface Note {
  id: string;
  leadId: string;
  content: string;
  createdAt: Date;
  author: string;
}

// Interface para anotações do Supabase
export interface HistoricoNote {
  historico_id: number;
  created_at: string;
  lead_id: number;
  historico_lead: string;
}

export interface User {
  id: string; // user_id
  nome: string;
  email: string;
  telefone?: string | null;
  empresa?: string | null;
  plano?: string | null;
  id_instancia_zapi?: string | null;
  token_instancia_zapi?: string | null;
  token_instancia_uazapi?: string | null;
  tipo?: string | null;
  // Campos específicos para membros
  isMembro?: boolean;
  membroId?: string;
  membro_cargo?: 'Administrador' | 'Usuario';
  user_id_empresa?: string; // ID do usuário principal da empresa (para membros)
}

export interface Membro {
  membro_id: string;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_cargo: 'Administrador' | 'Usuario';
  membro_status: 'Ativo' | 'Desativado';
  created_at?: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  conversionRate: number;
  leadsThisMonth: number;
  wonDeals: number;
  lostDeals: number;
}
