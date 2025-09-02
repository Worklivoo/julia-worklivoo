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
  avatar?: string | null;
  plano?: number | null;
  id_instancia_zapi?: string | null;
  token_instancia_zapi?: string | null;
}

export interface DashboardMetrics {
  totalLeads: number;
  conversionRate: number;
  leadsThisMonth: number;
  wonDeals: number;
  lostDeals: number;
}

// Interface para clientes da tabela console
export interface ConsoleClient {
  id: string;
  nome: string;
  url: string;
  senha: string;
  webhook_url: string;
  dify_token: string;
  user_id: string;
  cliente_ativo: boolean;
  mensagem_inicial?: string;
  created_at: string;
  updated_at: string;
}
