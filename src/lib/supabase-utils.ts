import { supabase } from './supabase'
import type { Database } from './supabase'

type Usuario = Database['public']['Tables']['usuarios_v2']['Row']
type UsuarioInsert = Database['public']['Tables']['usuarios_v2']['Insert']
type UsuarioUpdate = Database['public']['Tables']['usuarios_v2']['Update']

type BaseConhecimentoV2 = Database['public']['Tables']['base_conhecimento_v2']['Row']
type BaseConhecimentoV2Insert = Database['public']['Tables']['base_conhecimento_v2']['Insert']
type BaseConhecimentoV2Update = Database['public']['Tables']['base_conhecimento_v2']['Update']

// Função para obter usuário atual
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Função para obter dados do usuário da tabela usuarios_v2
export const getUserProfile = async (userId: string): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Erro ao buscar perfil do usuário:', error)
    return null
  }

  return data
}

// Função para criar perfil do usuário
export const createUserProfile = async (userData: UsuarioInsert): Promise<Usuario | null> => {
  const { data, error } = await supabase
    .from('usuarios_v2')
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
    .from('usuarios_v2')
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
    .from('usuarios_v2')
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
    .from('usuarios_v2')
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
    .from('usuarios_v2')
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
    .from('usuarios_v2')
    .select('user_id, conhecimento_id, documento_id, prompt')
    .eq('user_id', userId)
    .single()
  return { data, error }
}

export const updateBaseConhecimentoByUser = async (
  userId: string,
  updates: { conhecimento_id?: string | null; documento_id?: string | null; prompt?: string | null }
) => {
  const payload: Record<string, any> = {}
  if (updates.conhecimento_id !== undefined) payload.conhecimento_id = updates.conhecimento_id
  if (updates.documento_id !== undefined) payload.documento_id = updates.documento_id
  if (updates.prompt !== undefined) payload.prompt = updates.prompt

  const { data, error } = await supabase
    .from('usuarios_v2')
    .update(payload)
    .eq('user_id', userId)
    .select()
    .single()
  return { data, error }
}

export const getBaseConhecimentoV2ByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('base_conhecimento_v2')
    .select('*')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
  return { data: (data ?? []) as BaseConhecimentoV2[], error }
}

export const addBaseConhecimentoV2 = async (payload: BaseConhecimentoV2Insert) => {
  const { data, error } = await supabase
    .from('base_conhecimento_v2')
    .insert(payload)
    .select('*')
    .single()
  return { data: data as BaseConhecimentoV2 | null, error }
}

export const updateBaseConhecimentoV2 = async (params: { userId: string; conhecimentoId: number; updates: BaseConhecimentoV2Update }) => {
  const { data, error } = await supabase
    .from('base_conhecimento_v2')
    .update(params.updates)
    .eq('conhecimento_id', params.conhecimentoId)
    .eq('user_id', params.userId)
    .select('*')
    .single()
  return { data: data as BaseConhecimentoV2 | null, error }
}

export const deleteBaseConhecimentoV2 = async (params: { userId: string; conhecimentoId: number }) => {
  const { error } = await supabase
    .from('base_conhecimento_v2')
    .delete()
    .eq('conhecimento_id', params.conhecimentoId)
    .eq('user_id', params.userId)
  return { error }
}

export const getTelefoneQualificadoByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('telefone_qualificado, modo_qualificacao')
    .eq('user_id', userId)
    .single()
  if (error) {
    return { data: null, error }
  }
  return { 
    data: (data as any)?.telefone_qualificado ?? null, 
    modo: (data as any)?.modo_qualificacao ?? null,
    error: null 
  }
}

export const getLeadsWhatsappStatus = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('leads_whatsapp')
    .eq('user_id', userId)
    .single()
  if (error) {
    return { data: null, error }
  }
  const raw = (data as any)?.leads_whatsapp
  const normalized = String(raw ?? '').trim().toLowerCase()
  const enabled = ['ativado', 'ativo', 'true', '1', 'sim', 'yes'].includes(normalized)
  return { data: enabled ? 'Ativado' : 'Desativado', error: null }
}

export const updateLeadsWhatsappStatus = async (userId: string, status: string) => {
  const normalized = String(status ?? '').trim().toLowerCase()
  const enabled = ['ativado', 'ativo', 'true', '1', 'sim', 'yes'].includes(normalized)
  const finalStatus = enabled ? 'Ativado' : 'Desativado'
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ leads_whatsapp: finalStatus })
    .eq('user_id', userId)
    .select('leads_whatsapp')
    .single()
  return { data, error }
}

export const updateTelefoneQualificadoByUser = async (userId: string, telefone55: string, modo_qualificacao: string = 'Whatsapp') => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ 
      telefone_qualificado: telefone55,
      modo_qualificacao: modo_qualificacao 
    })
    .eq('user_id', userId)
    .select('telefone_qualificado, modo_qualificacao')
    .single()
  return { data, error }
}

export const getMensagemSaudacaoPortalByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('mensagem_saudacao_portal')
    .eq('user_id', userId)
    .single()
  if (error) {
    return { data: null, error }
  }
  return { data: (data as any)?.mensagem_saudacao_portal ?? null, error: null }
}

export const updateMensagemSaudacaoPortalByUser = async (userId: string, mensagem: string | null) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ mensagem_saudacao_portal: mensagem })
    .eq('user_id', userId)
    .select('mensagem_saudacao_portal')
    .single()
  return { data, error }
}

export const getMensagemSaudacaoConfigByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('mensagem_saudacao_portal,id_mensagem_saudacao_api_oficial_whatsapp')
    .eq('user_id', userId)
    .single()

  if (error) {
    return { data: null, error }
  }

  const row = data as unknown as { mensagem_saudacao_portal: string | null; id_mensagem_saudacao_api_oficial_whatsapp: string | null }
  return {
    data: {
      mensagem_saudacao_portal: row.mensagem_saudacao_portal ?? null,
      id_mensagem_saudacao_api_oficial_whatsapp: row.id_mensagem_saudacao_api_oficial_whatsapp ?? null,
    },
    error: null,
  }
}

export const updateMensagemSaudacaoConfigByUser = async (
  userId: string,
  payload: { mensagem_saudacao_portal: string | null; id_mensagem_saudacao_api_oficial_whatsapp: string | null }
) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({
      mensagem_saudacao_portal: payload.mensagem_saudacao_portal,
      id_mensagem_saudacao_api_oficial_whatsapp: payload.id_mensagem_saudacao_api_oficial_whatsapp,
    })
    .eq('user_id', userId)
    .select('mensagem_saudacao_portal,id_mensagem_saudacao_api_oficial_whatsapp')
    .single()

  return { data, error }
}

export const getFrequenciaFollowupByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('frequencia_followup')
    .eq('user_id', userId)
    .single()
  if (error) {
    return { data: null, error }
  }
  return { data: (data as any)?.frequencia_followup ?? null, error: null }
}

export const updateFrequenciaFollowupByUser = async (userId: string, frequencia: number | null) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ frequencia_followup: frequencia })
    .eq('user_id', userId)
    .select('frequencia_followup')
    .single()
  return { data, error }
}

export const getFollowupConfigByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('frequencia_followup,quantidade_maxima_followup')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { data: null, error };
  }

  const row = data as unknown as { frequencia_followup: number | null; quantidade_maxima_followup: number | null };
  return {
    data: {
      frequencia_followup: row.frequencia_followup ?? null,
      quantidade_maxima_followup: row.quantidade_maxima_followup ?? null,
    },
    error: null,
  };
};

export const updateFollowupConfigByUser = async (
  userId: string,
  payload: { frequencia_followup: number | null; quantidade_maxima_followup: number | null }
) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({
      frequencia_followup: payload.frequencia_followup,
      quantidade_maxima_followup: payload.quantidade_maxima_followup,
    })
    .eq('user_id', userId)
    .select('frequencia_followup,quantidade_maxima_followup')
    .single();

  return { data, error };
};

export const getTransbordoFollowupStatusByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('transbordo_followup_status')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: (data as any)?.transbordo_followup_status ?? false, error: null };
};

export const updateTransbordoFollowupStatusByUser = async (userId: string, status: boolean) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ transbordo_followup_status: status })
    .eq('user_id', userId)
    .select('transbordo_followup_status')
    .single();

  return { data, error };
};

export const getTransbordoFollowupEtapasByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('transbordo_followup_etapas')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { data: null, error };
  }

  return { data: (data as any)?.transbordo_followup_etapas ?? null, error: null };
};

export const updateTransbordoFollowupEtapasByUser = async (userId: string, etapas: string | null) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({ transbordo_followup_etapas: etapas })
    .eq('user_id', userId)
    .select('transbordo_followup_etapas')
    .single();

  return { data, error };
};

export const getTransbordoFollowupMetodoConfigByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('transbordo_followup_metodo,transbordo_followup_telefones')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { data: null, error };
  }

  const row = data as unknown as {
    transbordo_followup_metodo: string | null;
    transbordo_followup_telefones: string | null;
  };

  return {
    data: {
      transbordo_followup_metodo: row.transbordo_followup_metodo ?? null,
      transbordo_followup_telefones: row.transbordo_followup_telefones ?? null,
    },
    error: null,
  };
};

export const updateTransbordoFollowupMetodoConfigByUser = async (
  userId: string,
  payload: { transbordo_followup_metodo: string | null; transbordo_followup_telefones: string | null }
) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({
      transbordo_followup_metodo: payload.transbordo_followup_metodo,
      transbordo_followup_telefones: payload.transbordo_followup_telefones,
    })
    .eq('user_id', userId)
    .select('transbordo_followup_metodo,transbordo_followup_telefones')
    .single();

  return { data, error };
};

export const getGoogleAvaliacaoConfigByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('google_avaliacao,google_link_avaliacao')
    .eq('user_id', userId)
    .single();

  if (error) {
    return { data: null, error };
  }

  const row = data as unknown as {
    google_avaliacao: boolean | null;
    google_link_avaliacao: string | null;
  };

  return {
    data: {
      google_avaliacao: row.google_avaliacao ?? false,
      google_link_avaliacao: row.google_link_avaliacao ?? null,
    },
    error: null,
  };
};

export const updateGoogleAvaliacaoConfigByUser = async (
  userId: string,
  payload: { google_avaliacao: boolean; google_link_avaliacao: string | null }
) => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .update({
      google_avaliacao: payload.google_avaliacao,
      google_link_avaliacao: payload.google_link_avaliacao,
    })
    .eq('user_id', userId)
    .select('google_avaliacao,google_link_avaliacao')
    .single();

  return { data, error };
};

export const getFeedbacksByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('feedbacks_v2')
    .select('feedback_id,criado_em,mensagem_id,comentario_tipo,comentario_mensagem,user_id,status')
    .eq('user_id', userId)
    .order('criado_em', { ascending: false })
  return { data: (data || []) as any[], error }
}

// Removido: migração concluída para a tabela 'usuarios'

// Removido: migração concluiu o uso da antiga base de conhecimento
