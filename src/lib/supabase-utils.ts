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