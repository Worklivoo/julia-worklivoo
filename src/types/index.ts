export interface Lead {
  id: string;
  opportunityName: string;
  leadName: string;
  email: string;
  phone: string;
  company?: string;
  stage:
    | 'entrada'
    | 'tentando-contato'
    | 'contato-realizado'
    | 'qualificada'
    | 'orcamento-negociacao'
    | 'venda';
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
  ativo_fluxo_cadencia?: string | null;
  etapa_fluxo_followup?: string | null;
  ativo_followup?: string | null;
  membro_id?: string | null;
  conversa?: string;
  followup_dinamico?: boolean | null;
  _tarefas_total?: number | null;
  _tarefas_atrasadas?: number | null;
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
  planoNome?: string | null;
  planoQuantidadeLeads?: number | null;
  dia_vencimento?: number | null;
  cliente_status?: string | null;
  id_instancia_zapi?: string | null;
  token_instancia_zapi?: string | null;
  token_instancia_uazapi?: string | null;
  recomendar_api_oficial?: boolean | null;
  api_oficial?: boolean | null;
  id_api_whatsapp?: string | null;
  salvy_id?: string | null;
  waba_id?: string | null;
  tipo?: string | null;
  // Campos específicos para membros
  isMembro?: boolean;
  membroId?: string;
  membro_tipo?: 'Administrador' | 'Usuario';
  user_id_empresa?: string; // ID do usuário principal da empresa (para membros)
}

export interface Membro {
  membro_id: string;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_telefone?: string | null;
  membro_tipo: 'Administrador' | 'Usuario';
  membro_status: 'Ativado' | 'Desativado';
  created_at?: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  conversionRate: number;
  leadsThisMonth: number;
  wonDeals: number;
  lostDeals: number;
}

export interface ComunicadoV2 {
  idx?: number;
  comunicado_id: number;
  comunicado_titulo: string | null;
  comunicado_imagem: string | null;
  comunicado_ativo: boolean;
  max_visualizacoes: number;
  criado_em: string | null;
}

export interface ComunicadoHistoricoV2 {
  historico_id?: number;
  comunicado_id: number;
  user_id: string;
  qtd_visualizacoes: number;
  comunicado_ocultado: boolean;
  ultima_visualizacao_em: string | null;
}

export interface TarefaAtrasada {
  tarefa_id: string;
  tarefa_titulo: string;
  tarefa_descricao: string | null;
  lead_id: number;
  lead_nome: string | null;
  lead_oportunidade: string | null;
  membro_nome: string | null;
  data_vencimento: string;
  criado_em: string;
}
