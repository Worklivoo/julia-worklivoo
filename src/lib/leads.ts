import { supabase } from './supabase';

// Tipagem para inserção de lead
export type LeadInput = {
  lead_id?: number;
  lead_etapa: string;
  lead_status: string;
  lead_nome_pessoa: string;
  lead_empresa: string;
  lead_telefone: string;
  lead_email: string;
  lead_canal_origem: string;
  lead_notas: string;
  user_id: string;
  lead_nome_oportunidade: string;
  thread_dify?: string;
  ativo_fluxo_cadencia?: string;
  etapa_fluxo_followup?: string;
  ativo_ia?: string;
  membro_id?: string; // ID do membro responsável pelo lead
};

// Tipagem para inserção de anotação no histórico
export type HistoricoInput = {
  lead_id: number;
  historico_lead: string;
};

// Função para inserir um novo lead
export async function addLead(lead: LeadInput) {
  const { data, error } = await supabase
    .from('leads')
    .insert([lead]);
  return { data, error };
}

// Função para buscar todos os leads de um usuário específico
// Se membro_id for fornecido, filtra apenas os leads desse membro
export async function getLeadsByUser(user_id: string, membro_id?: string) {
  let query = supabase
    .from('leads')
    .select('*')
    .eq('user_id', user_id);
  
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
    .from('leads')
    .update(updates)
    .eq('lead_id', lead_id);
  return { data, error };
}

// Função para inserir uma nova anotação no histórico
export async function addHistorico(historico: HistoricoInput) {
  const { data, error } = await supabase
    .from('leads_historico')
    .insert([historico])
    .select();
  return { data, error };
}

// Função para buscar todas as anotações de um lead específico
export async function getHistoricoByLead(lead_id: number) {
  const { data, error } = await supabase
    .from('leads_historico')
    .select('*')
    .eq('lead_id', lead_id)
    .order('created_at', { ascending: false });
  return { data, error };
}

// Função para excluir um lead e todo seu histórico
export async function deleteLead(lead_id: string | number) {
  // Primeiro, excluir todas as anotações do histórico
  const { error: historicoError } = await supabase
    .from('leads_historico')
    .delete()
    .eq('lead_id', lead_id);
  
  if (historicoError) {
    return { data: null, error: historicoError };
  }
  
  // Depois, excluir o lead
  const { data, error } = await supabase
    .from('leads')
    .delete()
    .eq('lead_id', lead_id);
  
  return { data, error };
}