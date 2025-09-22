import { supabase } from './supabase';

// Interface para a tabela de membros
export interface Membro {
  membro_id: string;
  user_id: string;
  membro_nome: string;
  membro_email: string;
  membro_telefone?: string;
  membro_cargo: 'Administrador' | 'Usuario';
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
  cargo: 'Administrador' | 'Usuario',
  status: 'Ativo' | 'Desativado',
  userId: string // ID do usuário principal que está adicionando o membro
) => {
  try {
    console.log('Iniciando criação de usuário e membro...');
    console.log('Dados recebidos:', { email, nome, telefone, cargo, status, userId });

    // 1. Criar conta no Supabase Auth usando signUp com autoConfirm
    console.log('Criando usuário no Supabase Auth...');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined // Evita redirecionamento
      }
    });

    console.log('Resultado do Auth:', { authData, authError });

    if (authError) {
      console.error('Erro ao criar conta no Supabase Auth:', authError);
      return { data: null, error: authError };
    }

    if (!authData.user) {
      console.error('Usuário não foi criado no Auth');
      return { data: null, error: new Error('Falha ao criar usuário no Auth') };
    }

    console.log('Usuário criado no Auth com sucesso:', authData.user.id);

    // 2. Fazer logout do usuário recém-criado para manter a sessão original
    console.log('Fazendo logout do usuário recém-criado...');
    await supabase.auth.signOut();

    // 3. Verificar se o userId principal existe na tabela usuarios
    console.log('Verificando se userId principal existe na tabela usuarios:', userId);
    const { data: userExists, error: userCheckError } = await supabase
      .from('usuarios')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (userCheckError || !userExists) {
      console.error('Usuário principal não encontrado na tabela usuarios:', userCheckError);
      return { data: null, error: new Error('Usuário principal não encontrado na tabela usuarios') };
    }

    console.log('Usuário principal encontrado:', userExists);

    // 4. Adicionar como membro (usando Auth User ID como membro_id)
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
      return { data: null, error };
    }

    console.log('Membro adicionado com sucesso:', data);
    return { data, error: null, authUser: authData.user };
  } catch (error) {
    console.error('Exceção ao criar usuário e adicionar membro:', error);
    return { data: null, error };
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

    // Excluir da tabela membros
    const { error: deleteError } = await supabase
      .from('membros')
      .delete()
      .eq('membro_id', membroId);

    if (deleteError) {
      console.error('Erro ao excluir membro da tabela:', deleteError);
      return { success: false, error: deleteError };
    }

    // Tentar excluir do auth (isso pode falhar se não tivermos permissões admin)
    try {
      const { error: authError } = await supabase.auth.admin.deleteUser(membro.user_id);
      if (authError) {
        console.warn('Não foi possível excluir do auth (pode ser limitação de permissão):', authError);
      }
    } catch (authError) {
      console.warn('Erro ao tentar excluir do auth:', authError);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Erro ao excluir membro completamente:', error);
    return { success: false, error };
  }
};