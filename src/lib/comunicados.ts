import { supabase } from './supabase';
import type { ComunicadoV2, ComunicadoHistoricoV2 } from '@/types';

const COMUNICADO_REDIRECT_MAP: Record<number, string> = {
  1: '/configuracoes?aba=followup-dinamico',
};

const SESSAO_ID_KEY = 'comunicados_sessao_id';
const SESSAO_OCIOSIDADE_MS = 30 * 60 * 1000;
const MOSTRADO_NA_SESSAO_KEY_PREFIX = 'comunicado_sessao_mostrada';

const generateSessionId = (): string => {
  const rand = Math.random().toString(36).slice(2, 10);
  const now = Date.now();
  return `${now}-${rand}`;
};

export const getSharedSessionId = (): string => {
  if (typeof window === 'undefined') {
    return generateSessionId();
  }

  try {
    const raw = localStorage.getItem(SESSAO_ID_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { id: string; criado_em: number; ultimo_ping: number };
        const agora = Date.now();
        const ociosoPor = agora - parsed.ultimo_ping;

        if (ociosoPor < SESSAO_OCIOSIDADE_MS) {
          parsed.ultimo_ping = agora;
          localStorage.setItem(SESSAO_ID_KEY, JSON.stringify(parsed));
          return parsed.id;
        }

        console.log('[Comunicados] Sessão expirada por ociosidade, criando nova.');
      } catch {
        /* payload inválido, cai para criar novo */
      }
    }
  } catch {
    /* localStorage indisponível, segue com sessão em memória */
  }

  const novoId = generateSessionId();
  const payload = {
    id: novoId,
    criado_em: Date.now(),
    ultimo_ping: Date.now(),
  };
  try {
    localStorage.setItem(SESSAO_ID_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  console.log('[Comunicados] Nova sessão compartilhada criada:', novoId);
  return novoId;
};

const buildMostradoKey = (sessionId: string, comunicadoId: number): string => {
  return `${MOSTRADO_NA_SESSAO_KEY_PREFIX}:${sessionId}:${comunicadoId}`;
};

export const foiMostradoNaSessaoAtual = (comunicadoId: number): boolean => {
  if (typeof window === 'undefined') return false;
  const sessionId = getSharedSessionId();
  const key = buildMostradoKey(sessionId, comunicadoId);
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

export const marcarMostradoNaSessaoAtual = (comunicadoId: number): void => {
  if (typeof window === 'undefined') return;
  const sessionId = getSharedSessionId();
  const key = buildMostradoKey(sessionId, comunicadoId);
  try {
    localStorage.setItem(key, '1');
    console.log('[Comunicados] Marcado como mostrado na sessão:', { sessionId, comunicadoId });
  } catch {
    /* ignore */
  }
};

export const pingSharedSession = (): void => {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SESSAO_ID_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { id: string; criado_em: number; ultimo_ping: number };
    parsed.ultimo_ping = Date.now();
    localStorage.setItem(SESSAO_ID_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
};

export const getComunicadoRedirectUrl = (comunicadoId: number): string | null => {
  return COMUNICADO_REDIRECT_MAP[comunicadoId] ?? null;
};

export const fetchUsuarioV2Flags = async (
  userId: string
): Promise<{ followup_dinamico: boolean | null } | null> => {
  const { data, error } = await supabase
    .from('usuarios_v2')
    .select('followup_dinamico')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Comunicados] Erro ao buscar flags do usuario_v2:', error);
    return null;
  }

  if (!data) return null;

  return {
    followup_dinamico: (data as { followup_dinamico?: boolean | null }).followup_dinamico ?? null,
  };
};

type ComunicadoContextoAvaliacao = {
  flagsUsuario: {
    followup_dinamico: boolean | null;
  } | null;
};

const avaliarRegraComunicado = (
  comunicadoId: number,
  ctx: ComunicadoContextoAvaliacao
): { deveMostrar: boolean; motivo?: string } => {
  switch (comunicadoId) {
    case 1: {
      if (ctx.flagsUsuario?.followup_dinamico === true) {
        return { deveMostrar: false, motivo: 'Usuário já possui FollowUp Dinâmico ativo.' };
      }
      return { deveMostrar: true };
    }
    default:
      return { deveMostrar: true };
  }
};

export const comunicadoDeveMostrarParaUsuario = async (
  comunicadoId: number,
  userId: string
): Promise<{ deveMostrar: boolean; motivo?: string }> => {
  const flags = await fetchUsuarioV2Flags(userId);
  const resultado = avaliarRegraComunicado(comunicadoId, { flagsUsuario: flags });
  if (!resultado.deveMostrar && resultado.motivo) {
    console.log('[Comunicados] Bloqueado por regra de negócio:', resultado.motivo);
  }
  return resultado;
};

export const fetchActiveComunicado = async (): Promise<ComunicadoV2 | null> => {
  const { data, error } = await supabase
    .from('comunicados_v2')
    .select('*')
    .eq('comunicado_ativo', true)
    .order('criado_em', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Comunicados] Erro ao buscar comunicado ativo:', error);
    return null;
  }

  if (!data) {
    console.log('[Comunicados] Nenhum comunicado ativo encontrado.');
    return null;
  }

  return data as ComunicadoV2;
};

export const fetchHistoricoByUserAndComunicado = async (
  userId: string,
  comunicadoId: number
): Promise<ComunicadoHistoricoV2 | null> => {
  const { data, error } = await supabase
    .from('comunicado_historico_v2')
    .select('*')
    .eq('user_id', userId)
    .eq('comunicado_id', comunicadoId)
    .maybeSingle();

  if (error) {
    console.error('[Comunicados] Erro ao buscar histórico:', error);
    return null;
  }

  return data ? (data as ComunicadoHistoricoV2) : null;
};

export const upsertHistoricoIncrementView = async (
  userId: string,
  comunicadoId: number
): Promise<{ success: boolean }> => {
  const now = new Date().toISOString();

  try {
    const rpcResult = await supabase.rpc(
      'comunicado_historico_increment_view',
      {
        p_user_id: userId,
        p_comunicado_id: comunicadoId,
        p_ultima_visualizacao_em: now,
      }
    );
    if (!rpcResult.error) {
      console.log('[Comunicados] Visualização incrementada via RPC.');
      return { success: true };
    }
    console.warn('[Comunicados] RPC retornou erro, usando fallback:', rpcResult.error.message ?? rpcResult.error);
  } catch (rpcErr: any) {
    console.warn('[Comunicados] RPC indisponível/lançou exceção, usando fallback de upsert manual:', rpcErr?.message ?? rpcErr);
  }

  const existing = await fetchHistoricoByUserAndComunicado(userId, comunicadoId);

  if (!existing) {
    const { error: insertErr } = await supabase
      .from('comunicado_historico_v2')
      .insert({
        user_id: userId,
        comunicado_id: comunicadoId,
        qtd_visualizacoes: 1,
        comunicado_ocultado: false,
        ultima_visualizacao_em: now,
      });

    if (insertErr) {
      console.error('[Comunicados] Erro ao inserir histórico:', insertErr);
      return { success: false };
    }
    console.log('[Comunicados] Primeira visualização registrada.');
    return { success: true };
  }

  const { error: updateErr } = await supabase
    .from('comunicado_historico_v2')
    .update({
      qtd_visualizacoes: (existing.qtd_visualizacoes ?? 0) + 1,
      ultima_visualizacao_em: now,
    })
    .eq('comunicado_id', comunicadoId)
    .eq('user_id', userId);

  if (updateErr) {
    console.error('[Comunicados] Erro ao atualizar histórico:', updateErr);
    return { success: false };
  }

  console.log('[Comunicados] Visualização incrementada (fallback). Total:', (existing.qtd_visualizacoes ?? 0) + 1);
  return { success: true };
};

export const updateHistoricoOcultar = async (
  userId: string,
  comunicadoId: number
): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('comunicado_historico_v2')
    .update({
      comunicado_ocultado: true,
      ultima_visualizacao_em: new Date().toISOString(),
    })
    .eq('comunicado_id', comunicadoId)
    .eq('user_id', userId);

  if (error) {
    console.error('[Comunicados] Erro ao marcar como ocultado:', error);
    return { success: false };
  }

  console.log('[Comunicados] Comunicado marcado como ocultado pelo usuário.');
  return { success: true };
};

export const deveMostrarComunicado = (
  comunicado: ComunicadoV2,
  historico: ComunicadoHistoricoV2 | null
): boolean => {
  if (!comunicado.comunicado_ativo) {
    return false;
  }

  if (historico?.comunicado_ocultado) {
    console.log('[Comunicados] Comunicado ocultado pelo usuário.');
    return false;
  }

  const qtdAtual = historico?.qtd_visualizacoes ?? 0;
  const maximo = Number(comunicado.max_visualizacoes ?? 0);

  if (maximo > 0 && qtdAtual >= maximo) {
    console.log(`[Comunicados] Limite de visualizações atingido (${qtdAtual}/${maximo}).`);
    return false;
  }

  console.log(`[Comunicados] Deve mostrar. Visualizações: ${qtdAtual}/${maximo}.`);
  return true;
};
