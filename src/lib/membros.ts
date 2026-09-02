import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const normalizePhone = (value?: string | null) => {
  return String(value || '').replace(/\D/g, '');
};

// Interface para a tabela de membros
export interface Membro {
  idx?: number | null;
  membro_id: string;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_telefone?: string | null;
  membro_tipo: 'Administrador' | 'Usuario';
  membro_status: 'Ativado' | 'Desativado';
  created_at?: string | null;
}

// Função para obter todos os membros de uma empresa (user_id)
export const getMembrosByUser = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('membros_v2')
      .select('*')
      .eq('user_id', userId)
      .order('membro_nome', { ascending: true });

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
    const normalizedMembro = {
      ...membro,
      membro_email: String(membro.membro_email || '').trim().toLowerCase(),
      membro_telefone: normalizePhone(membro.membro_telefone),
    };
    console.log('Enviando para Supabase:', normalizedMembro);
    const { data, error } = await supabase
      .from('membros_v2')
      .insert(normalizedMembro)
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
  cargo: 'Administrador' | 'Usuario',
  status: 'Ativado' | 'Desativado',
  userId: string // ID do usuário principal que está adicionando o membro
) => {
  try {
    const normalizedPhone = normalizePhone(telefone);
    console.log('Iniciando criação de usuário e membro...');
    console.log('Dados recebidos:', { email, nome, telefone: normalizedPhone, cargo, status, userId });

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
      .from('usuarios_v2')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (userCheckError || !userExists) {
      console.error('Usuário principal não encontrado na tabela usuarios:', userCheckError);
      return { success: false, data: null, error: new Error('Usuário principal não encontrado na tabela usuarios') };
    }

    console.log('Usuário principal encontrado:', userExists);

    // 5. Adicionar como membro
    const newMembro = {
      user_id: userId, // ID do usuário principal da empresa
      membro_nome: nome,
      membro_email: String(email || '').trim().toLowerCase(),
      membro_telefone: normalizedPhone,
      membro_tipo: cargo,
      membro_status: status
    };

    console.log('Inserindo membro na tabela:', newMembro);

    const { data, error } = await supabase
      .from('membros_v2')
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
    const normalizedUpdates = {
      ...updates,
      ...(Object.prototype.hasOwnProperty.call(updates, 'membro_email')
        ? { membro_email: String(updates.membro_email || '').trim().toLowerCase() }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(updates, 'membro_telefone')
        ? { membro_telefone: normalizePhone(updates.membro_telefone) || null }
        : {}),
    };
    const { data, error } = await supabase
      .from('membros_v2')
      .update(normalizedUpdates)
      .eq('membro_id', membroId)
      .select();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Erro ao atualizar membro:', error);
    return { data: null, error };
  }
};

// Função para buscar membro por email (case-insensitive)
export const getMembroByEmail = async (email: string) => {
  try {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data, error } = await supabase
      .from('membros_v2')
      .select('*')
      .ilike('membro_email', normalizedEmail)
      .eq('membro_status', 'Ativado')
      .maybeSingle();

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
      .from('membros_v2')
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
      .from('membros_v2')
      .select('*')
      .eq('membro_id', membroId)
      .single();

    if (fetchError) {
      console.error('Erro ao buscar membro:', fetchError);
      return { success: false, error: fetchError };
    }

    console.log('Membro encontrado:', membro);

    // Excluir da tabela membros_v2 primeiro
    console.log('Excluindo membro da tabela membros_v2...');
    const { error: deleteError } = await supabase
      .from('membros_v2')
      .delete()
      .eq('membro_id', membroId);

    if (deleteError) {
      console.error('Erro ao excluir membro da tabela:', deleteError);
      return { success: false, error: deleteError };
    }

    console.log('Membro excluído da tabela com sucesso');

    // Excluir do Supabase Auth pelo email (membro_id não é o ID do Auth em membros_v2)
    console.log('Excluindo usuário do Supabase Auth pelo email:', membroEmail);
    try {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        return {
          success: true,
          error: null,
          warning: 'Membro excluído da tabela, mas houve erro ao listar usuários do Auth: ' + listError.message
        };
      }

      const authUser = (listData?.users || []).find((u) => (u.email || '').toLowerCase() === (membroEmail || '').toLowerCase());
      if (!authUser) {
        return {
          success: true,
          error: null,
          warning: 'Membro excluído da tabela, mas o usuário não foi encontrado no Auth para exclusão.'
        };
      }

      const { error: authError } = await supabase.auth.admin.deleteUser(authUser.id);
      
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
