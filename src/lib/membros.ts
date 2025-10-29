import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

// Interface para a tabela de membros
export interface Membro {
  membro_id: string;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_telefone?: string;
  membro_cargo: 'Usuario';
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
  telefone: string,
  cargo: 'Usuario',
  status: 'Ativo' | 'Desativado',
  userId: string // ID do usuário principal que está adicionando o membro
) => {
  try {
    console.log('Iniciando criação de usuário e membro...');
    console.log('Dados recebidos:', { email, nome, telefone, cargo, status, userId });

    // 1. Criar uma instância isolada do Supabase para criação de usuários
    // Isso evita interferir na sessão atual do admin
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    const isolatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
      }
    });

    // 2. Criar conta no Supabase Auth usando a instância isolada
    console.log('Criando usuário no Supabase Auth...');
    const { data: authData, error: authError } = await isolatedSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Evita redirecionamento
        data: {
          // Metadados opcionais do usuário
          nome: nome,
          cargo: cargo
        }
      }
    });

    console.log('Resultado do Auth:', { authData, authError });

    if (authError) {
      console.error('Erro ao criar conta no Supabase Auth:', authError);
      return { success: false, data: null, error: authError };
    }

    if (!authData.user) {
      console.error('Usuário não foi criado no Auth');
      return { success: false, data: null, error: new Error('Falha ao criar usuário no Auth') };
    }

    console.log('Usuário criado no Auth com sucesso:', authData.user.id);

    // 3. A instância isolada não afeta a sessão principal do admin
    // Não é necessário fazer logout ou manipular sessões

    // 4. Verificar se o userId principal existe na tabela usuarios
    console.log('Verificando se userId principal existe na tabela usuarios:', userId);
    const { data: userExists, error: userCheckError } = await supabase
      .from('usuarios')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (userCheckError || !userExists) {
      console.error('Usuário principal não encontrado na tabela usuarios:', userCheckError);
      return { success: false, data: null, error: new Error('Usuário principal não encontrado na tabela usuarios') };
    }

    console.log('Usuário principal encontrado:', userExists);

    // 5. Adicionar como membro (usando Auth User ID como membro_id)
    const newMembro = {
      membro_id: authData.user.id, // ID do usuário criado no Supabase Auth
      user_id: userId, // ID do usuário principal da empresa
      membro_nome: nome,
      membro_email: email,
      membro_telefone: telefone,
      membro_cargo: cargo,
      membro_status: status
    };

    console.log('Auth User ID sendo usado como membro_id:', authData.user.id);

    console.log('Inserindo membro na tabela:', newMembro);

    const { data, error } = await supabase
      .from('membros')
      .insert(newMembro)
      .select();

    console.log('Resultado da inserção na tabela membros:', { data, error });

    if (error) {
      console.error('Erro detalhado ao adicionar membro:', {
        error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      return { success: false, data: null, error };
    }

    console.log('Membro adicionado com sucesso:', data);
    return { success: true, data, error: null, authUser: authData.user };
  } catch (error) {
    console.error('Exceção ao criar usuário e adicionar membro:', error);
    return { success: false, data: null, error };
  }
};

// Função para atualizar um membro existente
export const updateMembro = async (membroId: string, updates: Partial<Omit<Membro, 'membro_id' | 'user_id'>>) => {
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
export const deleteMembro = async (membroId: string) => {
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

// Função para excluir membro completamente (tabela + auth)
export const deleteMembroComplete = async (membroId: string, membroEmail: string) => {
  try {
    console.log('Iniciando exclusão completa do membro:', { membroId, membroEmail });

    // Primeiro, buscar o membro para obter informações
    const { data: membro, error: fetchError } = await supabase
      .from('membros')
      .select('*')
      .eq('membro_id', membroId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar membro:', fetchError);
      return { success: false, error: fetchError };
    }

    console.log('Membro encontrado:', membro);

    // Excluir da tabela membros primeiro
    console.log('Excluindo membro da tabela membros...');
    const { error: deleteError } = await supabase
      .from('membros')
      .delete()
      .eq('membro_id', membroId);

    if (deleteError) {
      console.error('Erro ao excluir membro da tabela:', deleteError);
      return { success: false, error: deleteError };
    }

    console.log('Membro excluído da tabela com sucesso');

    // Excluir do Supabase Auth usando o membro_id (que é o ID do Auth)
    console.log('Excluindo usuário do Supabase Auth com ID:', membroId);
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(membroId);
      
      if (authError) {
        console.error('Erro ao excluir do Supabase Auth:', authError);
        // Se falhar na exclusão do Auth, ainda consideramos sucesso parcial
        // pois o membro já foi removido da tabela
        return { 
          success: true, 
          error: null, 
          warning: 'Membro excluído da tabela, mas houve erro ao excluir do Auth: ' + authError.message 
        };
      }
      
      console.log('Usuário excluído do Supabase Auth com sucesso');
    } catch (authError) {
      console.error('Exceção ao tentar excluir do auth:', authError);
      return { 
        success: true, 
        error: null, 
        warning: 'Membro excluído da tabela, mas houve exceção ao excluir do Auth: ' + authError 
      };
    }

    console.log('Exclusão completa realizada com sucesso');
    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao excluir membro completamente:', error);
    return { success: false, error };
  }
};