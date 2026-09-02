import { supabase } from './supabase';

// Tipagem para inserção de lead
export type LeadInput = {
  lead_id?: number;
  created_at?: string;
  update_mensagem?: string;
  conversa?: string;
  TRIAL?: string;
  lead_etapa?: string | null;
  lead_status?: string | null;
  lead_nome_pessoa?: string | null;
  lead_empresa?: string | null;
  lead_telefone: string;
  lead_email?: string | null;
  lead_canal_origem?: string | null;
  lead_notas?: string | null;
  lead_valor?: number | null;
  user_id: string;
  lead_nome_oportunidade?: string | null;
  ativo_fluxo_cadencia?: string;
  etapa_fluxo_followup?: string;
  ativo_followup?: string;
  ativo_ia?: string;
  membro_id?: string; // ID do membro responsável pelo lead
};

// Tipagem para inserção de anotação no histórico
export type HistoricoInput = {
  lead_id: number;
  historico_lead: string;
};

const isMissingRelationError = (error: any): boolean => {
  const code = (error as any)?.code;
  const message = String((error as any)?.message || '');
  return code === '42P01' || message.toLowerCase().includes('does not exist');
};

// Função para inserir um novo lead
export async function addLead(lead: LeadInput) {
  const { data, error } = await supabase
    .from('leads_v2')
    .insert([lead]);
  return { data, error };
}

// Função para buscar todos os leads de um usuário específico
// Se membro_id for fornecido, filtra apenas os leads desse membro
export async function getLeadsByUser(user_id: string, membro_id?: string) {
  const excludedOrigins = '("worklivoo-treinamento","worklivoo-treinamento-manual","worklivoo-lixo")';
  let query = supabase
    .from('leads_v2')
    .select('lead_id,created_at,update_mensagem,lead_etapa,lead_status,lead_nome_pessoa,lead_empresa,lead_telefone,lead_email,lead_canal_origem,lead_notas,lead_valor,user_id,lead_nome_oportunidade,ativo_followup,ativo_fluxo_cadencia,etapa_fluxo_followup,ativo_ia,membro_id,TRIAL,conversa,followup_dinamico')
    .eq('user_id', user_id)
    .not('lead_canal_origem', 'in', excludedOrigins)
    .or('lead_canal_origem.is.null,lead_canal_origem.not.ilike.%worklivoo-%');
  
  // Se membro_id for fornecido, adiciona filtro por membro_id
  if (membro_id) {
    query = query.eq('membro_id', membro_id);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data, error };
}

// Função para atualizar um lead (por exemplo, etapa)
export async function updateLead(lead_id: string | number, updates: Partial<LeadInput>) {
  const { data, error } = await supabase
    .from('leads_v2')
    .update(updates)
    .eq('lead_id', lead_id);
  return { data, error };
}

// Função para inserir uma nova anotação no histórico
export async function addHistorico(historico: HistoricoInput) {
  const { data, error } = await supabase
    .from('leads_historico_v2')
    .insert([historico])
    .select();
  if (error && isMissingRelationError(error)) {
    const fallback = await supabase.from('leads_historico').insert([historico]).select();
    return fallback;
  }
  return { data, error };
}

// Função para buscar todas as anotações de um lead específico
export async function getHistoricoByLead(lead_id: number) {
  const { data, error } = await supabase
    .from('leads_historico_v2')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false });
  if (error && isMissingRelationError(error)) {
    const fallback = await supabase
      .from('leads_historico')
      .select('*')
      .eq('lead_id', lead_id)
      .order('created_at', { ascending: false });
    return fallback;
  }
  return { data, error };
}

// Função para excluir um lead e todo seu histórico
export async function deleteLead(lead_id: string | number) {
  // Primeiro, excluir todas as anotações do histórico
  const { error: historicoError } = await supabase
    .from('leads_historico_v2')
    .delete()
    .eq('lead_id', lead_id);
  
  if (historicoError && isMissingRelationError(historicoError)) {
    await supabase.from('leads_historico').delete().eq('lead_id', lead_id);
  } else if (historicoError) {
    return { data: null, error: historicoError };
  }
  
  // Depois, excluir o lead
  const { data, error } = await supabase
    .from('leads_v2')
    .delete()
    .eq('lead_id', lead_id);
  
  return { data, error };
}
