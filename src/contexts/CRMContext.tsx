import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Lead, Note, User, DashboardMetrics } from '@/types';
import { supabase, type Database as SupabaseDatabase } from '@/lib/supabase';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from '@/lib/supabase-utils';
import { getLeadsByUser, addLead as addLeadToSupabase, updateLead as updateLeadSupabase, addHistorico, getHistoricoByLead, deleteLead as deleteLeadSupabase, type LeadInput } from '@/lib/leads';
import { getMembroByEmail } from '@/lib/membros';
import { DEFAULT_KNOWLEDGE_BASE } from '@/constants/knowledgeBase';

interface CRMContextType {
  leads: Lead[];
  user: User | null;
  isAuthenticated: boolean;
  needsTermsAcceptance: boolean;
  termsUserId: string | null;
  needsMemberUpdate: boolean;
  memberUpdateUserId: string | null;
  needsNpsSurvey: boolean;
  npsUserId: string | null;
  loadingUser: boolean;
  loadingLeads: boolean;
  hasLoadedLeads: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'> & { company?: string; notes?: string }) => Promise<{ success: boolean; error?: string }>;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => Promise<boolean>;
  addNote: (leadId: string, content: string) => Promise<boolean>;
  getNotesByLead: (leadId: string) => Promise<Note[]>;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; termsRequired?: boolean; memberUpdateRequired?: boolean; userId?: string }>;
  acceptTerms: () => Promise<{ success: boolean; error?: string; memberUpdateRequired?: boolean; userId?: string }>;
  confirmMemberUpdate: () => Promise<{ success: boolean; error?: string }>;
  submitNps: (payload: { nps_suporte: number; nps_ia: number; nps_padrao: number }) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, telefone?: string, empresa?: string, user_tipo?: string, leadsVolume?: number, valorPlano?: string, planoUsuario?: string, cicloPlano?: string, promptCliente?: string, grupoWhatsappId?: string | null) => Promise<{ success: boolean; userId?: string; error?: string }>;
  logout: () => void;
  getDashboardMetrics: () => DashboardMetrics;
  updateUser: (updates: Partial<User>) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

type UsuarioUpdate = SupabaseDatabase['public']['Tables']['usuarios_v2']['Update'];

type LeadsV2Row = {
  lead_id: number;
  created_at?: string | null;
  update_mensagem?: string | null;
  lead_etapa?: string | null;
  lead_status?: string | null;
  lead_nome_pessoa?: string | null;
  lead_empresa?: string | null;
  lead_telefone?: string | null;
  lead_email?: string | null;
  lead_canal_origem?: string | null;
  lead_notas?: string | null;
  lead_valor?: number | null;
  user_id?: string | null;
  lead_nome_oportunidade?: string | null;
  ativo_fluxo_cadencia?: string | null;
  etapa_fluxo_followup?: string | null;
  ativo_followup?: string | null;
  ativo_ia?: string | null;
  membro_id?: string | null;
  TRIAL?: string | null;
  conversa?: string | null;
  updated_at?: string | null;
  thread_dify?: string | null;
  followup_dinamico?: boolean | null;
};

type HistoricoRow = {
  historico_id: number;
  created_at: string;
  lead_id: number;
  historico_lead: string;
};

const parseTimestampToDate = (value: unknown): number => {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return 0;
  const normalized = raw
    .replace(' ', 'T')
    .replace(/\+00:00$/, 'Z')
    .replace(/\+00$/, 'Z')
    .replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};

const enrichLeadsWithTarefaStats = async (
  leads: Lead[],
  userIdEmpresa: string,
  correlationId: string
): Promise<Lead[]> => {
  const leadIds = leads
    .map((l) => Number(l.id))
    .filter((n) => Number.isFinite(n) && n > 0);

  console.log(`[CRM][tarefas-stats][${correlationId}] Iniciando enrich. user_id=${userIdEmpresa} leads=${leads.length} leadIdsComTarefasPotencial=${leadIds.length}`);

  if (!userIdEmpresa || leadIds.length === 0) {
    console.log(`[CRM][tarefas-stats][${correlationId}] Skip enrich (sem parâmetros).`);
    return leads;
  }

  try {
    const { data: tarefasData, error: tarefasError } = await supabase
      .from('lead_tarefas_v2')
      .select('lead_id, tarefa_concluida, data_vencimento, tarefa_id, user_id')
      .eq('user_id', userIdEmpresa)
      .in('lead_id', leadIds);

    if (tarefasError) {
      console.error(`[CRM][tarefas-stats][${correlationId}] Erro na query lead_tarefas_v2:`, tarefasError);
      return leads;
    }

    const statsByLeadId = (Array.isArray(tarefasData) ? tarefasData : []).reduce(
      (acc: Record<number, { pendentes: number; atrasadas: number }>, row: any) => {
        const concluida = Boolean((row as any).tarefa_concluida);
        if (concluida) return acc;

        const lid = Number((row as any).lead_id);
        if (!Number.isFinite(lid)) return acc;
        if (!acc[lid]) acc[lid] = { pendentes: 0, atrasadas: 0 };
        acc[lid].pendentes += 1;

        const dataVenc = (row as any).data_vencimento;
        if (dataVenc) {
          const t = parseTimestampToDate(String(dataVenc));
          if (t > 0 && t < Date.now()) {
            acc[lid].atrasadas += 1;
          }
        }
        return acc;
      },
      {} as Record<number, { pendentes: number; atrasadas: number }>
    );

    const leadsComStats = leads.map((lead) => {
      const lid = Number(lead.id);
      if (!Number.isFinite(lid)) return lead;
      const stats = statsByLeadId[lid];
      if (!stats || stats.pendentes <= 0) return lead;
      return {
        ...lead,
        _tarefas_total: stats.pendentes,
        _tarefas_atrasadas: stats.atrasadas || 0,
      };
    });

    const quantosEnriquecidos = leadsComStats.filter((l) => (l._tarefas_total ?? 0) > 0).length;
    console.log(`[CRM][tarefas-stats][${correlationId}] Sucesso (apenas pendentes/atrasadas). tarefasAbertasRows=${Array.isArray(tarefasData) ? (tarefasData as any[]).filter((r:any) => !Boolean(r.tarefa_concluida)).length : 0} leadsComTarefas=${quantosEnriquecidos} detalhes=`, statsByLeadId);

    return leadsComStats;
  } catch (err: any) {
    console.error(`[CRM][tarefas-stats][${correlationId}] Exception:`, err?.message || err, err);
    return leads;
  }
};

const supportedVerifyOtpTypes = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
] as const;

type VerifyOtpType = (typeof supportedVerifyOtpTypes)[number];

export const useCRM = () => {
  const context = useContext(CRMContext);
  if (!context) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
};

export const CRMProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsTermsAcceptance, setNeedsTermsAcceptance] = useState(false);
  const [termsUserId, setTermsUserId] = useState<string | null>(null);
  const [needsMemberUpdate, setNeedsMemberUpdate] = useState(false);
  const [memberUpdateUserId, setMemberUpdateUserId] = useState<string | null>(null);
  const [needsNpsSurvey, setNeedsNpsSurvey] = useState(false);
  const [npsUserId, setNpsUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [hasLoadedLeads, setHasLoadedLeads] = useState(false);
  const excludedLeadOrigins = new Set(['worklivoo-treinamento', 'worklivoo-treinamento-manual', 'worklivoo-lixo']);

  const normalizeString = (value: unknown): string => {
    return typeof value === 'string' ? value.trim() : '';
  };

  const parseSupabaseTimestamp = (value: unknown): Date => {
    if (value instanceof Date) return value;
    const raw = normalizeString(value);
    if (!raw) return new Date();
    const normalized = raw
      .replace(' ', 'T')
      .replace(/\+00:00$/, 'Z')
      .replace(/\+00$/, 'Z')
      .replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  };

  const getEndOfTodayLocal = (now: Date) => {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  };

  const clearAuthParamsFromUrl = () => {
    try {
      const url = new URL(window.location.href);
      const authParamKeys = [
        'code',
        'type',
        'token',
        'token_hash',
        'access_token',
        'refresh_token',
        'expires_in',
        'expires_at',
        'provider_token',
        'provider_refresh_token',
      ];

      for (const key of authParamKeys) {
        url.searchParams.delete(key);
      }

      url.hash = '';

      const cleanSearch = url.searchParams.toString();
      const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
      window.history.replaceState({}, document.title, cleanUrl);
    } catch (error) {
      console.error('[Auth] Falha ao limpar parâmetros da URL:', error);
    }
  };

  const isSupportedVerifyOtpType = (value: string): value is VerifyOtpType => {
    return supportedVerifyOtpTypes.includes(value as VerifyOtpType);
  };

  const consumeAuthSessionFromUrl = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const rawHash = window.location.hash || '';
    const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
    const hashParams = new URLSearchParams(hash);
    const searchParams = url.searchParams;

    const code = searchParams.get('code');
    const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
    const tokenHash = hashParams.get('token_hash') || searchParams.get('token_hash');
    const otpType = hashParams.get('type') || searchParams.get('type');

    if (!code && !tokenHash && !(accessToken && refreshToken)) {
      return;
    }

    try {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          throw error;
        }
        clearAuthParamsFromUrl();
        return;
      }

      if (tokenHash && otpType && isSupportedVerifyOtpType(otpType)) {
        const { error } = await supabase.auth.verifyOtp({
          type: otpType,
          token_hash: tokenHash,
        });

        if (error) {
          throw error;
        }
        clearAuthParamsFromUrl();
        return;
      }

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }
        clearAuthParamsFromUrl();
      }
    } catch (error) {
      console.error('[Auth] Falha ao consumir sessão da URL:', error);
    }
  };

  const extractLeadNameFromConversa = (conversaRaw: unknown): string => {
    const conversa = normalizeString(conversaRaw);
    if (!conversa) return '';
    const m = conversa.match(
      /CLIENTE:\s*(?:Meu nome é|Meu nome e|Meu nome eh|Sou o|Sou a|Eu sou)\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*){0,3})/i
    );
    return normalizeString(m?.[1] || '');
  };

  // Função auxiliar para buscar perfil do usuário (usuarios ou membros)
  const getCompleteUserProfile = async (userId: string, userEmail?: string) => {
    // Primeiro tenta buscar na tabela usuarios
    const profile = await getUserProfile(userId);
    if (profile) {
      return {
        id: profile.user_id,
        nome: profile.user_nome,
        email: profile.user_email,
        telefone: profile.user_telefone,
        empresa: profile.user_empresa,
        plano: profile.user_quantidade_leads !== null && profile.user_quantidade_leads !== undefined ? String(profile.user_quantidade_leads) : null,
        planoNome: profile.user_plano,
        planoQuantidadeLeads: profile.user_quantidade_leads,
        dia_vencimento: profile.dia_vencimento ?? null,
        cliente_status: profile.cliente_status,
        id_instancia_zapi: profile.id_instancia_zapi,
        token_instancia_zapi: profile.token_instancia_zapi,
        token_instancia_uazapi: profile.token_instancia_uazapi,
        recomendar_api_oficial: profile.recomendar_api_oficial ?? false,
        api_oficial: profile.api_oficial ?? false,
        id_api_whatsapp: profile.id_api_whatsapp ?? null,
        salvy_id: profile.salvy_id ?? null,
        waba_id: profile.waba_id ?? null,
        tipo: profile.user_tipo,
        isMembro: false
      };
    }
    
    // Se não encontrou na tabela usuarios e tem email, busca na tabela membros
    if (userEmail) {
      const { data: membro } = await getMembroByEmail(userEmail);
      if (membro) {
        const empresaProfile = await getUserProfile(membro.user_id);
        return {
          id: userId,
          nome: membro.membro_nome,
          email: membro.membro_email,
          telefone: membro.membro_telefone ?? null,
          empresa: empresaProfile?.user_empresa ?? null,
          plano: empresaProfile?.user_quantidade_leads !== null && empresaProfile?.user_quantidade_leads !== undefined ? String(empresaProfile.user_quantidade_leads) : null,
          planoNome: empresaProfile?.user_plano ?? null,
          planoQuantidadeLeads: empresaProfile?.user_quantidade_leads ?? null,
          dia_vencimento: empresaProfile?.dia_vencimento ?? null,
          cliente_status: empresaProfile?.cliente_status ?? null,
          id_instancia_zapi: empresaProfile?.id_instancia_zapi ?? null,
          token_instancia_zapi: empresaProfile?.token_instancia_zapi ?? null,
          token_instancia_uazapi: empresaProfile?.token_instancia_uazapi ?? null,
          recomendar_api_oficial: empresaProfile?.recomendar_api_oficial ?? false,
          api_oficial: empresaProfile?.api_oficial ?? false,
          id_api_whatsapp: empresaProfile?.id_api_whatsapp ?? null,
          salvy_id: empresaProfile?.salvy_id ?? null,
          waba_id: empresaProfile?.waba_id ?? null,
          tipo: empresaProfile?.user_tipo ?? null,
          isMembro: true,
          membroId: membro.membro_id,
          membro_tipo: membro.membro_tipo,
          user_id_empresa: membro.user_id // ID do usuário principal da empresa
        };
      }
    }
    return null;
  };

  const getTermsStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios_v2')
      .select('aceite_termos_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { accepted: true, exists: false, aceite_termos_at: null as string | null };
    }

    if (!data) {
      return { accepted: true, exists: false, aceite_termos_at: null as string | null };
    }

    return { accepted: !!data.aceite_termos_at, exists: true, aceite_termos_at: data.aceite_termos_at as string | null };
  };

  const getMemberUpdateStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('membros_v2')
      .select('nova_atualizacao')
      .eq('membro_id', userId)
      .maybeSingle();

    if (error) {
      return { completed: true, exists: false, nova_atualizacao: null as boolean | null };
    }

    if (!data) {
      return { completed: true, exists: false, nova_atualizacao: null as boolean | null };
    }

    return {
      completed: data.nova_atualizacao === true,
      exists: true,
      nova_atualizacao: data.nova_atualizacao ?? null,
    };
  };

  const getNpsStatus = async (userId: string) => {
    const { data, error } = await supabase
      .from('usuarios_v2')
      .select('nps_data_envio')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { due: false, exists: false, nps_data_envio: null as string | null };
    }

    if (!data) {
      return { due: false, exists: false, nps_data_envio: null as string | null };
    }

    const raw = (data as any).nps_data_envio as string | null | undefined;
    if (!raw) {
      return { due: true, exists: true, nps_data_envio: null as string | null };
    }

    const npsDate = parseSupabaseTimestamp(raw);
    const endOfToday = getEndOfTodayLocal(new Date());
    const due = npsDate.getTime() <= endOfToday.getTime();
    return { due, exists: true, nps_data_envio: raw as string | null };
  };

  // Persistência de sessão e carregamento do usuário
  useEffect(() => {
    let isInitialLoad = true;
    const getSessionAndProfile = async (event?: string) => {
      // Evita re-execuções desnecessárias em eventos de token refresh
      if (!isInitialLoad && event === 'TOKEN_REFRESHED') {
        return;
      }
      
      // Determina se deve mostrar o loading
      // Apenas mostra loading no carregamento inicial ou em eventos críticos como logout
      // Para atualizações de sessão em background (como ao focar na aba), fazemos silenciosamente
      const shouldShowLoading = isInitialLoad || event === 'SIGNED_OUT';
      
      if (shouldShowLoading) {
        setLoadingUser(true);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const termsStatus = await getTermsStatus(session.user.id);
        if (termsStatus.exists && !termsStatus.accepted) {
          setNeedsTermsAcceptance(true);
          setTermsUserId(session.user.id);
          setNeedsMemberUpdate(false);
          setMemberUpdateUserId(null);
          setNeedsNpsSurvey(false);
          setNpsUserId(null);
          setUser(null);
          setIsAuthenticated(false);
          if (shouldShowLoading) {
            setLoadingUser(false);
          }
          isInitialLoad = false;
          return;
        }

        setNeedsTermsAcceptance(false);
        setTermsUserId(null);

        const memberUpdateStatus = await getMemberUpdateStatus(session.user.id);
        if (memberUpdateStatus.exists && !memberUpdateStatus.completed) {
          setNeedsMemberUpdate(true);
          setMemberUpdateUserId(session.user.id);
          setNeedsNpsSurvey(false);
          setNpsUserId(null);
          setUser(null);
          setIsAuthenticated(false);
          if (shouldShowLoading) {
            setLoadingUser(false);
          }
          isInitialLoad = false;
          return;
        }

        setNeedsMemberUpdate(false);
        setMemberUpdateUserId(null);

        const npsStatus = await getNpsStatus(session.user.id);
        if (npsStatus.exists && npsStatus.due) {
          setNeedsNpsSurvey(true);
          setNpsUserId(session.user.id);
        } else {
          setNeedsNpsSurvey(false);
          setNpsUserId(null);
        }

        const userProfile = await getCompleteUserProfile(session.user.id, session.user.email);
        if (userProfile) {
          // Só atualiza se realmente mudou
          setUser(prevUser => {
            if (!prevUser || JSON.stringify(prevUser) !== JSON.stringify(userProfile)) {
              return userProfile;
            }
            return prevUser;
          });
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setNeedsTermsAcceptance(false);
        setTermsUserId(null);
        setNeedsMemberUpdate(false);
        setMemberUpdateUserId(null);
        setNeedsNpsSurvey(false);
        setNpsUserId(null);
      }
      
      if (shouldShowLoading) {
        setLoadingUser(false);
      }
      isInitialLoad = false;
    };
    const initializeAuth = async () => {
      await consumeAuthSessionFromUrl();
      await getSessionAndProfile();
    };

    initializeAuth();
    // Listener para mudanças de sessão
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      getSessionAndProfile(event);
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // Carregar leads do usuário logado do Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchLeads = async () => {
      if (!user) {
        if (isMounted) {
          setLeads([]);
          setLoadingLeads(false);
          setHasLoadedLeads(true);
        }
        return;
      }
      
      // Evita múltiplas chamadas simultâneas
      if (loadingUser) {
        if (isMounted) {
          setLoadingLeads(false);
        }
        return;
      }
      
      // Determina qual user_id usar para buscar os leads
      // Se for membro, usa o user_id_empresa, senão usa o próprio id
      const userIdForLeads = user.isMembro ? user.user_id_empresa : user.id;
      const isAdminMember = Boolean(user.isMembro && user.membro_tipo === 'Administrador');
      
      if (!userIdForLeads) {
        if (isMounted) {
          setLeads([]);
          setLoadingLeads(false);
          setHasLoadedLeads(true);
        }
        return;
      }

      if (isMounted) {
        setLoadingLeads(true);
        setHasLoadedLeads(false);
      }

      try {
        // PRIMEIRO: Remover leads de teste se existirem
        const testLeadCleanup = supabase
          .from('leads_v2')
          .delete()
          .eq('user_id', userIdForLeads)
          .like('lead_nome_pessoa', '%Teste%');
        if (user.isMembro && user.membroId && !isAdminMember) {
          await testLeadCleanup.eq('membro_id', user.membroId);
        } else {
          await testLeadCleanup;
        }
        
        // Determinar se deve aplicar filtro por membro_id
        // Se for membro, filtra apenas os leads dele
        let membroIdFilter: string | undefined;
        if (user.isMembro && user.membroId && !isAdminMember) {
          membroIdFilter = user.membroId;
        }
        
        const { data, error } = await getLeadsByUser(userIdForLeads, membroIdFilter);
        
        if (error || !data) {
          if (isMounted) setLeads([]);
          return;
        }
        
        // Mapear os campos do Supabase para o tipo Lead do frontend
        const mappedLeads: Lead[] = (data as LeadsV2Row[])
          .filter((lead) => {
            const origin = normalizeString(lead?.lead_canal_origem).toLowerCase();
            if (origin.includes('worklivoo-')) return false;
            return !excludedLeadOrigins.has(origin);
          })
          .map((lead) => {
            const leadId = normalizeString(lead?.lead_id?.toString());

            const dbLeadName = normalizeString(lead?.lead_nome_pessoa);
            const convLeadName = extractLeadNameFromConversa(lead?.conversa);
            const leadName = dbLeadName || convLeadName || 'N/A';

            const dbOpportunityName = normalizeString(lead?.lead_nome_oportunidade);
            const opportunityName = dbOpportunityName || normalizeString(lead?.lead_telefone) || 'N/A';

            return {
              id: leadId,
              opportunityName,
              leadName,
              email: normalizeString(lead?.lead_email),
              phone: normalizeString(lead?.lead_telefone),
              company: normalizeString(lead?.lead_empresa),
              stage: mapLeadEtapaToStage(lead?.lead_etapa),
              status: mapLeadStatus(lead?.lead_status),
              createdAt: parseSupabaseTimestamp(lead?.created_at),
              updatedAt: parseSupabaseTimestamp(lead?.update_mensagem || lead?.updated_at || lead?.created_at),
              source: normalizeString(lead?.lead_canal_origem),
              value: Number(lead?.lead_valor ?? 0) || 0,
              notes: [],
              priority: 'medium' as const,
              expectedCloseDate: undefined,
              lead_notas: normalizeString(lead?.lead_notas),
              thread_dify: normalizeString(lead?.thread_dify),
              ativo_ia: normalizeString(lead?.ativo_ia),
              ativo_fluxo_cadencia: normalizeString(lead?.ativo_fluxo_cadencia) || null,
              etapa_fluxo_followup: normalizeString(lead?.etapa_fluxo_followup) || null,
              ativo_followup: normalizeString(lead?.ativo_followup) || null,
              membro_id: lead?.membro_id ?? null,
              conversa: normalizeString(lead?.conversa),
              followup_dinamico: Boolean(lead?.followup_dinamico),
            };
          });

        const leadIdsToEnrich = mappedLeads
          .map((l) => Number(l.id))
          .filter((n) => Number.isFinite(n) && n > 0);

        const correlationId = `fetchLeads-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        console.log(`[CRM][fetchLeads][${correlationId}] Mapeados ${mappedLeads.length} leads. user_id=${userIdForLeads} leadIdsParaEnriquecer=${leadIdsToEnrich.length}`);

        const leadsWithStats = await enrichLeadsWithTarefaStats(mappedLeads, userIdForLeads, correlationId);
        
         if (isMounted) {
           setLeads(leadsWithStats);
         }
      } finally {
        if (isMounted) {
          setLoadingLeads(false);
          setHasLoadedLeads(true);
        }
      }
    };
    
    fetchLeads();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, loadingUser]); // Só depende do ID do usuário e do estado de loading

  // Funções auxiliares para mapear etapas e status
  function mapLeadEtapaToStage(lead_etapa: string | null | undefined): Lead['stage'] {
    switch (normalizeString(lead_etapa)) {
      case 'Entrada do lead':
      case 'Entrada do Lead':
        return 'entrada';
      case 'Tentando contato':
        return 'tentando-contato';
      case 'Contato realizado':
        return 'contato-realizado';
      case 'Oportunidade qualificada':
        return 'qualificada';
      case 'Orçamento/Negociação':
      case 'Orcamento/Negociacao':
        return 'orcamento-negociacao';
      case 'Venda':
        return 'venda';
      default:
        return 'entrada';
    }
  }
  function mapLeadStatus(lead_status: string | null | undefined): Lead['status'] {
    switch (normalizeString(lead_status)) {
      case 'Aberto':
        return 'active';
      case 'Perdido':
        return 'lost';
      case 'Ganho':
      case 'Vendido':
        return 'won';
      default:
        return 'active';
    }
  }

  // Função de login
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string; termsRequired?: boolean; memberUpdateRequired?: boolean; userId?: string }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setUser(null);
      setIsAuthenticated(false);
      setNeedsTermsAcceptance(false);
      setTermsUserId(null);
      setNeedsMemberUpdate(false);
      setMemberUpdateUserId(null);
      setNeedsNpsSurvey(false);
      setNpsUserId(null);
      return { success: false, error: error?.message || 'Credenciais inválidas. Verifique email e senha.' };
    }

    const termsStatus = await getTermsStatus(data.user.id);
    if (termsStatus.exists && !termsStatus.accepted) {
      setUser(null);
      setIsAuthenticated(false);
      setNeedsTermsAcceptance(true);
      setTermsUserId(data.user.id);
      setNeedsMemberUpdate(false);
      setMemberUpdateUserId(null);
      setNeedsNpsSurvey(false);
      setNpsUserId(null);
      return { success: true, termsRequired: true, userId: data.user.id };
    }

    setNeedsTermsAcceptance(false);
    setTermsUserId(null);

    const memberUpdateStatus = await getMemberUpdateStatus(data.user.id);
    if (memberUpdateStatus.exists && !memberUpdateStatus.completed) {
      setUser(null);
      setIsAuthenticated(false);
      setNeedsMemberUpdate(true);
      setMemberUpdateUserId(data.user.id);
      setNeedsNpsSurvey(false);
      setNpsUserId(null);
      return { success: true, memberUpdateRequired: true, userId: data.user.id };
    }

    setNeedsMemberUpdate(false);
    setMemberUpdateUserId(null);
    
    const userProfile = await getCompleteUserProfile(data.user.id, data.user.email);
    if (userProfile) {
      setUser(userProfile);
      setIsAuthenticated(true);
      setNeedsTermsAcceptance(false);
      setTermsUserId(null);
      setNeedsMemberUpdate(false);
      setMemberUpdateUserId(null);

      const npsStatus = await getNpsStatus(data.user.id);
      if (npsStatus.exists && npsStatus.due) {
        setNeedsNpsSurvey(true);
        setNpsUserId(data.user.id);
      } else {
        setNeedsNpsSurvey(false);
        setNpsUserId(null);
      }

      return { success: true };
    }
    setUser(null);
    setIsAuthenticated(false);
    setNeedsTermsAcceptance(false);
    setTermsUserId(null);
    setNeedsMemberUpdate(false);
    setMemberUpdateUserId(null);
    setNeedsNpsSurvey(false);
    setNpsUserId(null);
    return { success: false, error: 'Perfil não encontrado. Usuário não vinculado a cliente ou membro.' };
  };

  const acceptTerms = async (): Promise<{ success: boolean; error?: string; memberUpdateRequired?: boolean; userId?: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || termsUserId;

    console.log('[Terms] acceptTerms() start', { userId });

    if (!userId) {
      return { success: false, error: 'Sessão não encontrada.' };
    }

    const { error } = await supabase
      .from('usuarios_v2')
      .update({ aceite_termos_at: new Date().toISOString() })
      .eq('user_id', userId);

    console.log('[Terms] acceptTerms() update result', { userId, error });

    if (error) {
      return { success: false, error: 'Não foi possível registrar o aceite. Tente novamente.' };
    }

    setNeedsTermsAcceptance(false);
    setTermsUserId(null);

    const memberUpdateStatus = await getMemberUpdateStatus(userId);
    if (memberUpdateStatus.exists && !memberUpdateStatus.completed) {
      setNeedsMemberUpdate(true);
      setMemberUpdateUserId(userId);
      setNeedsNpsSurvey(false);
      setNpsUserId(null);
      setUser(null);
      setIsAuthenticated(false);
      return { success: true, memberUpdateRequired: true, userId };
    }

    setNeedsMemberUpdate(false);
    setMemberUpdateUserId(null);

    const userProfile = await getCompleteUserProfile(userId, session?.user?.email);
    if (userProfile) {
      setUser(userProfile);
      setIsAuthenticated(true);

      const npsStatus = await getNpsStatus(userId);
      if (npsStatus.exists && npsStatus.due) {
        setNeedsNpsSurvey(true);
        setNpsUserId(userId);
      } else {
        setNeedsNpsSurvey(false);
        setNpsUserId(null);
      }

      return { success: true };
    }

    setUser(null);
    setIsAuthenticated(false);
    return { success: false, error: 'Perfil não encontrado. Usuário não vinculado a cliente ou membro.' };
  };

  const confirmMemberUpdate = async (): Promise<{ success: boolean; error?: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || memberUpdateUserId;

    if (!userId) {
      return { success: false, error: 'Sessão não encontrada.' };
    }

    const { error } = await supabase
      .from('membros_v2')
      .update({ nova_atualizacao: true })
      .eq('membro_id', userId);

    if (error) {
      return { success: false, error: 'Não foi possível registrar a atualização. Tente novamente.' };
    }

    setNeedsMemberUpdate(false);
    setMemberUpdateUserId(null);
    return { success: true };
  };

  const submitNps = async (payload: { nps_suporte: number; nps_ia: number; nps_padrao: number }): Promise<{ success: boolean; error?: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || npsUserId;

    if (!userId) {
      return { success: false, error: 'Sessão não encontrada.' };
    }

    const nps_suporte = Number(payload?.nps_suporte);
    const nps_ia = Number(payload?.nps_ia);
    const nps_padrao = Number(payload?.nps_padrao);

    const valid = (v: number) => Number.isFinite(v) && v >= 0 && v <= 10;
    if (!valid(nps_suporte) || !valid(nps_ia) || !valid(nps_padrao)) {
      return { success: false, error: 'Preencha todas as notas de 0 a 10.' };
    }

    const now = new Date();
    const next = new Date(now);
    next.setDate(next.getDate() + 60);

    const { error } = await supabase
      .from('usuarios_v2')
      .update({
        nps_suporte,
        nps_ia,
        nps_padrao,
        nps_data_envio: next.toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      return { success: false, error: 'Não foi possível registrar o envio do NPS. Tente novamente.' };
    }

    setNeedsNpsSurvey(false);
    setNpsUserId(null);
    return { success: true };
  };

  // Função de registro
  const register = async (nome: string, email: string, password: string, telefone?: string, empresa?: string, user_tipo?: string, leadsVolume?: number, valorPlano?: string, planoUsuario?: string, cicloPlano?: string, promptCliente?: string, grupoWhatsappId?: string | null): Promise<{ success: boolean; userId?: string; error?: string }> => {
    try {
      const normalizeEmpresa = (value: string) => {
        const noDiacritics = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleaned = noDiacritics.replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
        return cleaned.toUpperCase();
      };

      const buildEmailAlias = (value: string) => {
        const noDiacritics = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const cleaned = noDiacritics.replace(/[^A-Za-z0-9]+/g, '').toLowerCase();
        return cleaned ? `integracao+${cleaned}@worklivoo.com` : null;
      };

      const normalizeTelefone = (value: string) => {
        const digits = value.replace(/\D/g, '');
        if (digits.startsWith('55')) return digits;
        return `55${digits}`;
      };

      const normalizedTelefone = telefone ? normalizeTelefone(telefone) : null;
      const normalizedEmpresa = empresa ? normalizeEmpresa(empresa) : null;
      const emailAlias = normalizedEmpresa ? buildEmailAlias(normalizedEmpresa) : null;

      // 1. Criar usuário no Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (error || !data.user) {
        console.error('Erro ao criar usuário:', error);
        return { success: false, error: error?.message || 'Erro ao criar usuário' };
      }

      const valorMensalNumber = valorPlano ? Number(valorPlano) : null;
      const userValorMensal = valorMensalNumber !== null && Number.isFinite(valorMensalNumber) ? valorMensalNumber : (valorPlano || null);

      // 2. Criar perfil na tabela usuarios_v2 e aguardar conclusão
      const profile = await createUserProfile({
        user_id: data.user.id,
        user_nome: nome,
        user_email: email,
        email_alias: emailAlias,
        user_telefone: normalizedTelefone,
        user_empresa: normalizedEmpresa,
        user_cnpj: null,
        user_plano: planoUsuario || null,
        user_quantidade_leads: leadsVolume ?? null,
        plano_ciclo: cicloPlano || 'Mensal',
        user_valor_mensal: userValorMensal,
        plano_status: 'Ativado',
        cliente_status: 'Desativado',
        prompt: promptCliente || null,
        user_tipo: user_tipo || null,
        grupo_whatsapp_id: grupoWhatsappId ?? null,
      });

      if (!profile) {
        console.error('Erro ao criar perfil do usuário');
        return { success: false, error: 'Erro ao criar perfil do usuário' };
      }

      // Inserir perguntas da base de conhecimento de acordo com o tipo de cliente
      const kbQuestions = DEFAULT_KNOWLEDGE_BASE[user_tipo as keyof typeof DEFAULT_KNOWLEDGE_BASE] || DEFAULT_KNOWLEDGE_BASE['Outros'];
      if (kbQuestions && kbQuestions.length > 0) {
        const kbData = kbQuestions.map(q => ({
          user_id: data.user.id,
          pergunta: q.pergunta,
          resposta: q.resposta,
          ativo_inativo: true
        }));
        
        const { error: kbError } = await supabase.from('base_conhecimento_v2').insert(kbData);
        if (kbError) {
          console.error('Erro ao inserir base de conhecimento:', kbError);
          // Não vamos travar o registro se falhar ao inserir a base de conhecimento, mas logamos
        }
      }

      // 3. NÃO definir usuário como autenticado após registro
      // O usuário deve fazer login após o registro
      console.log('Usuário registrado com sucesso. Redirecionando para login...');
      
      // 4. Fazer logout para garantir que o usuário não fique logado automaticamente
      await supabase.auth.signOut();
      
      return { success: true, userId: data.user.id };
    } catch (error) {
      console.error('Erro durante o registro:', error);
      return { success: false, error: 'Erro durante o registro' };
    }
  };

  // Função de logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setNeedsTermsAcceptance(false);
    setTermsUserId(null);
    setNeedsMemberUpdate(false);
    setMemberUpdateUserId(null);
    setNeedsNpsSurvey(false);
    setNpsUserId(null);
  };

  // Atualizar perfil do usuário
  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const payload: Record<string, unknown> = {};
    if (updates.nome !== undefined) payload.user_nome = updates.nome;
    if (updates.email !== undefined) payload.user_email = updates.email;
    if (updates.telefone !== undefined) payload.user_telefone = updates.telefone;
    if (updates.empresa !== undefined) payload.user_empresa = updates.empresa;
    if (updates.planoNome !== undefined || updates.plano !== undefined) payload.user_plano = updates.planoNome ?? updates.plano;
    if (updates.planoQuantidadeLeads !== undefined) payload.user_quantidade_leads = updates.planoQuantidadeLeads;
    if (updates.cliente_status !== undefined) payload.cliente_status = updates.cliente_status;
    if (updates.id_instancia_zapi !== undefined) payload.id_instancia_zapi = updates.id_instancia_zapi;
    if (updates.token_instancia_zapi !== undefined) payload.token_instancia_zapi = updates.token_instancia_zapi;
    if (updates.token_instancia_uazapi !== undefined) payload.token_instancia_uazapi = updates.token_instancia_uazapi;
    if (updates.recomendar_api_oficial !== undefined) payload.recomendar_api_oficial = updates.recomendar_api_oficial;
    if (updates.api_oficial !== undefined) payload.api_oficial = updates.api_oficial;
    if (updates.id_api_whatsapp !== undefined) payload.id_api_whatsapp = updates.id_api_whatsapp;
    if (updates.salvy_id !== undefined) payload.salvy_id = updates.salvy_id;
    if (updates.waba_id !== undefined) payload.waba_id = updates.waba_id;
    if (updates.tipo !== undefined) payload.user_tipo = updates.tipo;

    const updated = await updateUserProfile(user.id, payload as UsuarioUpdate);
    if (updated) {
      setUser((prevUser) => ({
        ...(prevUser ?? {}),
        id: updated.user_id,
        nome: updated.user_nome,
        email: updated.user_email,
        telefone: updated.user_telefone,
        empresa: updated.user_empresa,
        plano: updated.user_quantidade_leads !== null && updated.user_quantidade_leads !== undefined ? String(updated.user_quantidade_leads) : null,
        planoNome: updated.user_plano,
        planoQuantidadeLeads: updated.user_quantidade_leads,
        dia_vencimento: updated.dia_vencimento ?? null,
        cliente_status: updated.cliente_status,
        id_instancia_zapi: updated.id_instancia_zapi ?? null,
        token_instancia_zapi: updated.token_instancia_zapi ?? null,
        token_instancia_uazapi: updated.token_instancia_uazapi ?? null,
        recomendar_api_oficial: updated.recomendar_api_oficial ?? false,
        api_oficial: updated.api_oficial ?? false,
        id_api_whatsapp: updated.id_api_whatsapp ?? null,
        salvy_id: updated.salvy_id ?? null,
        waba_id: updated.waba_id ?? null,
        tipo: updated.user_tipo,
      }));
    }
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'> & { company?: string; notes?: string }): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }
    const normalizeLeadPhone = (value: string) => {
      const digits = String(value || '').replace(/\D/g, '');
      if (!digits) return '';
      const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
      const limitedLocalDigits = localDigits.slice(0, 11);
      return limitedLocalDigits ? `55${limitedLocalDigits}` : '';
    };

    let userIdForLead = user.isMembro ? user.user_id_empresa : user.id;
    let membroIdForLead: string | undefined;

    if (user.isMembro) {
      const { data: membroData, error: membroError } = await getMembroByEmail(user.email);
      if (membroError || !membroData) {
        return { success: false, error: 'Erro ao identificar o membro responsável.' };
      }
      userIdForLead = membroData.user_id;
      membroIdForLead = membroData.membro_id;
    }
    
    if (!userIdForLead) {
      return { success: false, error: 'Erro ao identificar usuário da empresa.' };
    }

    try {
      const normalizedPhone = normalizeLeadPhone(leadData.phone);
      if (!normalizedPhone) {
        return { success: false, error: 'Telefone do lead inválido.' };
      }

      // Mapear os dados do lead para o formato do Supabase
      const supabaseLeadData: LeadInput = {
        lead_etapa: 'Entrada do lead',
        lead_status: 'Aberto',
        lead_nome_pessoa: leadData.leadName,
        lead_empresa: leadData.company || '',
        lead_telefone: normalizedPhone,
        lead_email: leadData.email || '',
        lead_canal_origem: leadData.source,
        lead_notas: leadData.notes || '',
        user_id: userIdForLead,
        lead_nome_oportunidade: leadData.opportunityName,
        conversa: '',
        update_mensagem: new Date().toISOString(),
        TRIAL: 'NÃO',
      };
      
      // Se for membro, usa explicitamente os dados vindos da tabela membros_v2
      if (membroIdForLead) {
        supabaseLeadData.membro_id = membroIdForLead;
      }

      // Adicionar no Supabase
      const { data, error } = await addLeadToSupabase(supabaseLeadData);
      
      if (error) {
        return { success: false, error: error.message };
      }

      // Recarregar os leads do Supabase para manter sincronização
      // Aplicar o mesmo filtro por membro_id se necessário
      let membroIdFilter: string | undefined;
      if (user.isMembro && membroIdForLead && user.membro_tipo !== 'Administrador') {
        membroIdFilter = membroIdForLead;
      }
      
      const { data: updatedLeads, error: fetchError } = await getLeadsByUser(userIdForLead, membroIdFilter);
      
      if (fetchError || !updatedLeads) {
        return { success: false, error: 'Erro ao recarregar leads.' };
      }

      // Mapear os leads atualizados
      const mappedLeads: Lead[] = (updatedLeads as LeadsV2Row[]).map((lead) => {
        const leadId = normalizeString(lead?.lead_id?.toString());

        const dbLeadName = normalizeString(lead?.lead_nome_pessoa);
        const convLeadName = extractLeadNameFromConversa(lead?.conversa);
        const leadName = dbLeadName || convLeadName || 'N/A';

        const dbOpportunityName = normalizeString(lead?.lead_nome_oportunidade);
        const opportunityName = dbOpportunityName || normalizeString(lead?.lead_telefone) || 'N/A';

        return {
          id: leadId,
          opportunityName,
          leadName,
          email: normalizeString(lead?.lead_email),
          phone: normalizeString(lead?.lead_telefone),
          company: normalizeString(lead?.lead_empresa),
          stage: mapLeadEtapaToStage(lead?.lead_etapa),
          status: mapLeadStatus(lead?.lead_status),
          createdAt: parseSupabaseTimestamp(lead?.created_at),
          updatedAt: parseSupabaseTimestamp(lead?.update_mensagem || lead?.updated_at || lead?.created_at),
          source: normalizeString(lead?.lead_canal_origem),
          value: Number(lead?.lead_valor ?? 0) || 0,
          notes: [],
          priority: 'medium' as const,
          expectedCloseDate: undefined,
          conversa: normalizeString(lead?.conversa),
          followup_dinamico: Boolean(lead?.followup_dinamico),
        };
      });

      const cid = `addLead-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
      const enriched = await enrichLeadsWithTarefaStats(mappedLeads, userIdForLead, cid);
      setLeads(enriched);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Erro interno ao adicionar lead.' };
    }
  };

  // Função auxiliar para mapear status do frontend para Supabase
  function mapStatusToLeadStatus(status: Lead['status']): string {
    switch (status) {
      case 'active':
        return 'Aberto';
      case 'lost':
        return 'Perdido';
      case 'won':
        return 'Vendido';
      default:
        return 'Aberto';
    }
  }

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    const normalizedUpdates: Partial<Lead> = { ...updates };

    if (normalizedUpdates.stage === 'venda') {
      normalizedUpdates.status = 'won';
    }

    // Se o update for de etapa, atualizar no Supabase
    const supabaseUpdates: Record<string, unknown> = {};
    
    // Verificar se a etapa está sendo alterada para adicionar ao histórico
    if (normalizedUpdates.stage) {
      // Encontrar o lead atual para obter a etapa anterior
      const currentLead = leads.find(lead => lead.id === id);
      if (currentLead && currentLead.stage !== normalizedUpdates.stage) {
        // Mapear as etapas para nomes legíveis
        const etapaAnterior = mapStageToLeadEtapa(currentLead.stage);
        const novaEtapa = mapStageToLeadEtapa(normalizedUpdates.stage);
        
        // Criar mensagem do histórico
        const historicoMessage = `Etapa atualizada: ${etapaAnterior} -> ${novaEtapa}`;
        
        // Adicionar ao histórico
        try {
          await addHistorico({
            lead_id: parseInt(id),
            historico_lead: historicoMessage
          });
        } catch (error) {
          console.error('Erro ao adicionar histórico:', error);
        }
      }
      
      supabaseUpdates.lead_etapa = mapStageToLeadEtapa(normalizedUpdates.stage);
    }
    
    if (normalizedUpdates.status) {
      if (normalizedUpdates.status === 'won') {
        supabaseUpdates.lead_status = 'Vendido';
      } else if (normalizedUpdates.status === 'lost') {
        supabaseUpdates.lead_status = 'Perdido';
      } else if (normalizedUpdates.status === 'active') {
        supabaseUpdates.lead_status = 'Aberto';
      }
    }

    if (normalizedUpdates.leadName) {
      supabaseUpdates.lead_nome_pessoa = normalizedUpdates.leadName;
    }
    if (normalizedUpdates.email) {
      supabaseUpdates.lead_email = normalizedUpdates.email;
    }
    if (normalizedUpdates.phone) {
      supabaseUpdates.lead_telefone = normalizedUpdates.phone;
    }
    if (normalizedUpdates.opportunityName) {
      supabaseUpdates.lead_nome_oportunidade = normalizedUpdates.opportunityName;
    }
    if (normalizedUpdates.source) {
      supabaseUpdates.lead_canal_origem = normalizedUpdates.source;
    }
    if (normalizedUpdates.lead_notas !== undefined) {
      supabaseUpdates.lead_notas = normalizedUpdates.lead_notas;
    }
    if (normalizedUpdates.expectedCloseDate) {
      supabaseUpdates.lead_data_fechamento_esperada = normalizedUpdates.expectedCloseDate instanceof Date ? normalizedUpdates.expectedCloseDate.toISOString() : normalizedUpdates.expectedCloseDate;
    }
    
    if (normalizedUpdates.membro_id !== undefined) {
      supabaseUpdates.membro_id = normalizedUpdates.membro_id;
    }
    
    if (normalizedUpdates.ativo_ia !== undefined) {
      supabaseUpdates.ativo_ia = normalizedUpdates.ativo_ia;
      supabaseUpdates.ativo_followup = normalizedUpdates.ativo_ia === 'Sim' ? 'TRUE' : 'FALSE';
    }

    if (normalizedUpdates.ativo_fluxo_cadencia !== undefined) {
      supabaseUpdates.ativo_fluxo_cadencia = normalizedUpdates.ativo_fluxo_cadencia;
    }

    if (normalizedUpdates.etapa_fluxo_followup !== undefined) {
      supabaseUpdates.etapa_fluxo_followup = normalizedUpdates.etapa_fluxo_followup;
    }

    if (normalizedUpdates.ativo_followup !== undefined) {
      supabaseUpdates.ativo_followup = normalizedUpdates.ativo_followup;
    }
    if (normalizedUpdates.value !== undefined) {
      supabaseUpdates.lead_valor = Number(normalizedUpdates.value) || 0;
    }

    // Adicione outros campos se necessário
    if (Object.keys(supabaseUpdates).length > 0) {
      const { error } = await updateLeadSupabase(id, supabaseUpdates);
      
      if (error) {
        console.error('Erro ao atualizar lead no Supabase:', error);
        // Não atualizar localmente se falhar no banco (ou mostrar aviso)
        // Mas para manter consistência otimista, talvez manter, mas logar erro é crucial.
      }
      
      // Atualizar localmente também
      setLeads(prev => prev.map(lead => 
        lead.id === id 
          ? { ...lead, ...normalizedUpdates, updatedAt: new Date() }
          : lead
      ));
    }
  };

  function mapStageToLeadEtapa(stage: Lead['stage']): string {
    switch (stage) {
      case 'entrada':
        return 'Entrada do lead';
      case 'tentando-contato':
        return 'Tentando contato';
      case 'contato-realizado':
        return 'Contato realizado';
      case 'qualificada':
        return 'Oportunidade qualificada';
      case 'orcamento-negociacao':
        return 'Orçamento/Negociação';
      case 'venda':
        return 'Venda';
      default:
        return 'Entrada do lead';
    }
  }

  const deleteLead = async (id: string): Promise<boolean> => {
    try {
      const { error } = await deleteLeadSupabase(id);
      
      if (error) {
        console.error('Erro ao excluir lead:', error);
        return false;
      }
      
      // Atualizar o estado local removendo o lead
      setLeads(prev => prev.filter(lead => lead.id !== id));
      return true;
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
      return false;
    }
  };

  const addNote = async (leadId: string, content: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const historicoData = {
        lead_id: parseInt(leadId),
        historico_lead: content
      };
      
      const { error } = await addHistorico(historicoData);
      
      if (error) {
        console.error('Erro ao adicionar anotação:', error);
        return false;
      }
      
      // Atualizar o estado local com a nova anotação
      const newNote: Note = {
        id: Date.now().toString(),
        leadId,
        content,
        createdAt: new Date(),
        author: user.nome || 'Admin'
      };

      setLeads(prev => prev.map(lead => 
        lead.id === leadId 
          ? { ...lead, notes: [...lead.notes, newNote] }
          : lead
      ));
      
      return true;
    } catch (error) {
      console.error('Erro ao adicionar anotação:', error);
      return false;
    }
  };

  const getNotesByLead = async (leadId: string): Promise<Note[]> => {
    if (!user) return [];
    
    try {
      const { data, error } = await getHistoricoByLead(parseInt(leadId));
      
      if (error) {
        console.error('Erro ao buscar anotações:', error);
        return [];
      }
      
      // Converter dados do Supabase para o formato Note
      const notes: Note[] = ((data as HistoricoRow[]) || []).map((historico) => ({
        id: historico.historico_id.toString(),
        leadId: leadId,
        content: historico.historico_lead,
        createdAt: new Date(historico.created_at),
        author: user.nome || 'Admin'
      }));
      
      return notes;
    } catch (error) {
      console.error('Erro ao buscar anotações:', error);
      return [];
    }
  };

  // Memoizar métricas do dashboard para evitar recálculos constantes
  const dashboardMetrics = useMemo((): DashboardMetrics => {
    const totalLeads = leads.length;
    const wonDeals = leads.filter(lead => lead.status === 'won').length;
    const lostDeals = leads.filter(lead => lead.status === 'lost').length;
    const conversionRate = totalLeads > 0 ? (wonDeals / totalLeads) * 100 : 0;
    const now = new Date();
    const leadsThisMonth = leads.filter(lead => {
      const leadDate = new Date(lead.createdAt);
      return leadDate.getMonth() === now.getMonth() && 
             leadDate.getFullYear() === now.getFullYear();
    }).length;
    return {
      totalLeads,
      conversionRate,
      leadsThisMonth,
      wonDeals,
      lostDeals
    };
  }, [leads]);

  const getDashboardMetrics = (): DashboardMetrics => {
    return dashboardMetrics;
  };

  return (
    <CRMContext.Provider value={{
      leads,
      user,
      isAuthenticated,
      needsTermsAcceptance,
      termsUserId,
      needsMemberUpdate,
      memberUpdateUserId,
      needsNpsSurvey,
      npsUserId,
      loadingUser,
      loadingLeads,
      hasLoadedLeads,
      addLead,
      updateLead,
      deleteLead,
      addNote,
      getNotesByLead,
      login,
      acceptTerms,
      confirmMemberUpdate,
      submitNps,
      register,
      logout,
      getDashboardMetrics,
      updateUser,
    }}>
      {children}
    </CRMContext.Provider>
  );
};
