import { supabase } from './supabase'
import type { Database } from './supabase'

type Usuario = Database['public']['Tables']['usuarios']['Row']
type UsuarioInsert = Database['public']['Tables']['usuarios']['Insert']
type UsuarioUpdate = Database['public']['Tables']['usuarios']['Update']

// Função para obter usuário atual
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Função para obter dados do usuário da tabela usuarios
export const getUserProfile = async (userId: string): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    console.error('Erro ao buscar perfil do usuário:', error)
    return null
  }

  return data
}

// Função para criar perfil do usuário
export const createUserProfile = async (userData: UsuarioInsert): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios')
    .insert(userData)
    .select()
    .single()

  if (error) {
    console.error('Erro ao criar perfil do usuário:', error)
    return null
  }

  return data
}

// Função para atualizar perfil do usuário
export const updateUserProfile = async (userId: string, updates: UsuarioUpdate): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Erro ao atualizar perfil do usuário:', error)
    return null
  }

  return data
}

// Função para upload de avatar
export const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
  // Validar tipo de arquivo imagem
  if (!file.type.startsWith('image/')) {
    console.error('Arquivo não é uma imagem.');
    return null;
  }
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-avatar.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true // Permite sobrescrever avatar
    });

  if (error) {
    console.error('Erro ao fazer upload do avatar:', error.message, error);
    return null;
  }

  // Gerar URL pública
  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  if (!publicData || !publicData.publicUrl) {
    console.error('Erro ao gerar URL pública do avatar.');
    return null;
  }

  return publicData.publicUrl;
}

// Função para deletar avatar antigo
export const deleteAvatar = async (avatarUrl: string): Promise<boolean> => {
  // Extrair nome do arquivo da URL
  const fileName = avatarUrl.split('/').pop()
  if (!fileName) return false

  const { error } = await supabase.storage
    .from('avatars')
    .remove([fileName])

  if (error) {
    console.error('Erro ao deletar avatar:', error)
    return false
  }

  return true
}

export type FonteDadosInput = {
  tipo: string
  link: string
  body?: string | null
  user_id: string
}

export const addFonteDados = async (input: FonteDadosInput) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      scrapper_tipo: input.tipo,
      scrapper_link: input.link,
      scrapper_body: input.body ?? null,
    })
    .eq('user_id', input.user_id)
    .select('user_id, user_empresa, scrapper_tipo, scrapper_link, scrapper_body')
    .single()
  if (error) {
    return { data: null, error }
  }
  const normalized = {
    id: data.user_id,
    tipo: data.scrapper_tipo ?? 'HTML',
    link: data.scrapper_link ?? '',
    body: data.scrapper_body ?? null,
    cliente: data.user_empresa ?? null,
  }
  return { data: normalized, error: null }
}

export const getFontesDadosByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('user_id, user_empresa, scrapper_tipo, scrapper_link, scrapper_body')
    .eq('user_id', userId)
    .single()
  if (error) {
    return { data: null, error }
  }
  const item = {
    id: data.user_id,
    tipo: data.scrapper_tipo ?? 'HTML',
    link: data.scrapper_link ?? '',
    body: data.scrapper_body ?? null,
    cliente: data.user_empresa ?? null,
  }
  return { data: item ? [item] : [], error: null }
}

export const updateFonteDados = async (
  userId: string,
  updates: { tipo?: string; link?: string; body?: string | null }
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      scrapper_tipo: updates.tipo,
      scrapper_link: updates.link,
      scrapper_body: updates.body ?? null,
    })
    .eq('user_id', userId)
    .select('user_id, user_empresa, scrapper_tipo, scrapper_link, scrapper_body')
    .single()
  if (error) {
    return { data: null, error }
  }
  const normalized = {
    id: data.user_id,
    tipo: data.scrapper_tipo ?? 'HTML',
    link: data.scrapper_link ?? '',
    body: data.scrapper_body ?? null,
    cliente: data.user_empresa ?? null,
  }
  return { data: normalized, error: null }
}

export const getBaseConhecimentoByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios')
    .select('user_id, conhecimento_id, documento_id, prompt')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export const updateBaseConhecimentoByUser = async (
  userId: string,
  updates: { conhecimento_id?: string | null; documento_id?: string | null; prompt?: string | null }
) => {
  const { data, error } = await supabase
    .from('usuarios')
    .update({
      conhecimento_id: updates.conhecimento_id ?? null,
      documento_id: updates.documento_id ?? null,
      prompt: updates.prompt ?? null,
    })
    .eq('user_id', userId)
    .select()
    .single()
  return { data, error }
}

// Removido: migração concluída para a tabela 'usuarios'

// Removido: migração concluiu o uso da antiga base de conhecimento