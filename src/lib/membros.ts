import { supabase } from './supabase';

// Interface para a tabela de membros
export interface Membro {
  membro_id: number;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_cargo: 'Administrador' | 'Corretor';
  membro_status: 'Ativo' | 'Desativado';
  created_at?: string;
}

// Função para obter todos os membros de uma empresa (user_id)
export const getMembrosByUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('membros')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao buscar membros:', error);
    return { data: null, error };
  }
};

// Função para adicionar um novo membro
export const addMembro = async (membro: Omit<Membro, 'membro_id' | 'created_at'>) => {
  try {
    console.log('Enviando para Supabase:', membro);
    const { data, error } = await supabase
      .from('membros')
      .insert(membro)
      .select();

    console.log('Resposta do Supabase:', { data, error });
    if (error) {
      console.error('Erro do Supabase:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Exceção ao adicionar membro:', error);
    return { data: null, error };
  }
};

// Função para criar um novo usuário no Supabase Auth e adicionar como membro
export const createUserAndAddMembro = async (
  email: string,
  password: string,
  nome: string,
  cargo: 'Administrador' | 'Corretor',
  status: 'Ativo' | 'Desativado',
  userId: string // ID do usuário principal que está adicionando o membro
) => {
  try {
    // 1. Criar conta no Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      console.error('Erro ao criar conta no Supabase Auth:', authError);
      return { data: null, error: authError || new Error('Falha ao criar usuário') };
    }

    // 2. Adicionar como membro (sem criar perfil na tabela usuarios)
    const newMembro = {
      user_id: userId, // ID do usuário principal
      membro_nome: nome,
      membro_email: email,
      membro_cargo: cargo,
      membro_status: status
    };

    const { data, error } = await supabase
      .from('membros')
      .insert(newMembro)
      .select();

    if (error) {
      console.error('Erro ao adicionar membro:', error);
      return { data: null, error };
    }

    return { data, error: null, authUser: authData.user };
  } catch (error) {
    console.error('Exceção ao criar usuário e adicionar membro:', error);
    return { data: null, error };
  }
};

// Função para atualizar um membro existente
export const updateMembro = async (membroId: number, updates: Partial<Omit<Membro, 'membro_id' | 'user_id'>>) => {
  try {
    const { data, error } = await supabase
      .from('membros')
      .update(updates)
      .eq('membro_id', membroId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    return { data: null, error };
  }
};

// Função para buscar membro por email
export const getMembroByEmail = async (email: string) => {
  try {
    const { data, error } = await supabase
      .from('membros')
      .select('*')
      .eq('membro_email', email)
      .eq('membro_status', 'Ativo')
      .single();

    if (error) {
      console.error('Erro ao buscar membro por email:', error);
      return { data: null, error };
    }
    return { data, error: null };
  } catch (error) {
    console.error('Exceção ao buscar membro por email:', error);
    return { data: null, error };
  }
};

// Função para excluir um membro
export const deleteMembro = async (membroId: number) => {
  try {
    const { error } = await supabase
      .from('membros')
      .delete()
      .eq('membro_id', membroId);

    if (error) throw error;
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao excluir membro:', error);
    return { success: false, error };
  }
};