import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Lead, Note, User, DashboardMetrics } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
} from '@/lib/supabase-utils';
import { getLeadsByUser, addLead as addLeadToSupabase, updateLead as updateLeadSupabase, addHistorico, getHistoricoByLead, deleteLead as deleteLeadSupabase } from '@/lib/leads';
import { getMembroByEmail } from '@/lib/membros';

interface CRMContextType {
  leads: Lead[];
  user: User | null;
  isAuthenticated: boolean;
  loadingUser: boolean;
  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'>) => Promise<{ success: boolean; error?: string }>;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => Promise<boolean>;
  addNote: (leadId: string, content: string) => Promise<boolean>;
  getNotesByLead: (leadId: string) => Promise<Note[]>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, telefone?: string, empresa?: string) => Promise<boolean>;
  logout: () => void;
  getDashboardMetrics: () => DashboardMetrics;
  updateUser: (updates: Partial<User>) => void;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

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
  const [loadingUser, setLoadingUser] = useState(true);

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
        avatar: profile.user_avatar,
        plano: profile.user_plano,
        id_instancia_zapi: profile.id_instancia_zapi,
        token_instancia_zapi: profile.token_instancia_zapi,
        isMembro: false
      };
    }
    
    // Se não encontrou na tabela usuarios e tem email, busca na tabela membros
    if (userEmail) {
      const { data: membro } = await getMembroByEmail(userEmail);
      if (membro) {
        return {
          id: userId,
          nome: membro.membro_nome,
          email: membro.membro_email,
          telefone: null,
          empresa: null,
          avatar: null,
          plano: null,
          id_instancia_zapi: null,
          token_instancia_zapi: null,
          isMembro: true,
          membroId: membro.membro_id,
          membro_cargo: membro.membro_cargo,
          user_id_empresa: membro.user_id // ID do usuário principal da empresa
        };
      }
    }
    
    return null;
  };

  // Persistência de sessão e carregamento do usuário
  useEffect(() => {
    let isInitialLoad = true;
    const getSessionAndProfile = async (event?: string) => {
      // Evita re-execuções desnecessárias em eventos de token refresh
      if (!isInitialLoad && event === 'TOKEN_REFRESHED') {
        return;
      }
      
      setLoadingUser(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
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
      }
      setLoadingUser(false);
      isInitialLoad = false;
    };
    getSessionAndProfile();
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
        if (isMounted) setLeads([]);
        return;
      }
      
      // Evita múltiplas chamadas simultâneas
      if (loadingUser) {
        return;
      }
      
      // Determina qual user_id usar para buscar os leads
      // Se for membro, usa o user_id_empresa, senão usa o próprio id
      const userIdForLeads = user.isMembro ? user.user_id_empresa : user.id;
      
      if (!userIdForLeads) {
        if (isMounted) setLeads([]);
        return;
      }
      
      // PRIMEIRO: Remover leads de teste se existirem
      await supabase
        .from('leads')
        .delete()
        .eq('user_id', userIdForLeads)
        .like('lead_nome_pessoa', '%Teste%');
      
      // Determinar se deve aplicar filtro por membro_id
      // Se for membro com cargo 'Usuario', filtra apenas os leads dele
      let membroIdFilter: string | undefined;
      if (user.isMembro && user.membro_cargo === 'Usuario') {
        membroIdFilter = user.membroId;
      }
      
      const { data, error } = await getLeadsByUser(userIdForLeads, membroIdFilter);
      
      if (error || !data) {
        if (isMounted) setLeads([]);
        return;
      }
      
      // Mapear os campos do Supabase para o tipo Lead do frontend
      const mappedLeads: Lead[] = await Promise.all(data.map(async (lead: any) => {
          // Buscar anotações para cada lead
          const notes = await getNotesByLead(lead.lead_id?.toString() || '');
          
          
          
          const mappedLead = {
          id: lead.lead_id?.toString(),
          opportunityName: lead.lead_nome_oportunidade,
          leadName: lead.lead_nome_pessoa,
          email: lead.lead_email,
          phone: lead.lead_telefone,
          stage: mapLeadEtapaToStage(lead.lead_etapa),
          status: mapLeadStatus(lead.lead_status),
          createdAt: lead.created_at ? new Date(lead.created_at) : new Date(),
          updatedAt: lead.updated_at ? new Date(lead.updated_at) : new Date(),
          source: lead.lead_canal_origem,
          value: 0, // Ajuste se houver campo de valor
          notes: notes, // Carregar anotações do banco
          priority: 'medium', // Ajuste se houver prioridade
          expectedCloseDate: undefined,
          lead_notas: lead.lead_notas,
          thread_dify: lead.thread_dify,
          ativo_ia: lead.ativo_ia,
          };
          
          return mappedLead;
      }));
      

      
       if (isMounted) {
         setLeads(mappedLeads);
       }
    };
    
    fetchLeads();
    
    return () => {
      isMounted = false;
    };
  }, [user?.id, loadingUser]); // Só depende do ID do usuário e do estado de loading

  // Funções auxiliares para mapear etapas e status
  function mapLeadEtapaToStage(lead_etapa: string): Lead['stage'] {
    switch (lead_etapa) {
      case 'Entrada do Lead':
        return 'entrada';
      case 'Tentando contato':
        return 'tentando-contato';
      case 'Contato realizado':
        return 'contato-realizado';
      case 'Oportunidade qualificada':
        return 'qualificada';
      default:
        return 'entrada';
    }
  }
  function mapLeadStatus(lead_status: string): Lead['status'] {
    switch (lead_status) {
      case 'Aberto':
        return 'active';
      case 'Perdido':
        return 'lost';
      case 'Ganho':
        return 'won';
      default:
        return 'active';
    }
  }

  // Função de login
  const login = async (email: string, password: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
    
    const userProfile = await getCompleteUserProfile(data.user.id, data.user.email);
    if (userProfile) {
      setUser(userProfile);
      setIsAuthenticated(true);
      return true;
    }
    
    setUser(null);
    setIsAuthenticated(false);
    return false;
  };

  // Função de registro
  const register = async (nome: string, email: string, password: string, telefone?: string, empresa?: string): Promise<boolean> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error || !data.user) {
      setUser(null);
      setIsAuthenticated(false);
      return false;
    }
    // Cria perfil na tabela usuarios
    const profile = await createUserProfile({
      user_id: data.user.id,
      user_nome: nome,
      user_email: email,
      user_telefone: telefone || null,
      user_empresa: empresa || null,
      user_avatar: null,
    });
    if (profile) {
      setUser({
        id: profile.user_id,
        nome: profile.user_nome,
        email: profile.user_email,
        telefone: profile.user_telefone,
        empresa: profile.user_empresa,
        avatar: profile.user_avatar,
        plano: profile.user_plano,
      });
      setIsAuthenticated(true);
      return true;
    }
    setUser(null);
    setIsAuthenticated(false);
    return false;
  };

  // Função de logout
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
  };

  // Atualizar perfil do usuário
  const updateUser = async (updates: Partial<User>) => {
    if (!user) return;
    const updated = await updateUserProfile(user.id, {
      user_nome: updates.nome,
      user_email: updates.email,
      user_telefone: updates.telefone,
      user_empresa: updates.empresa,
      user_avatar: updates.avatar,
      user_plano: updates.plano,
    });
    if (updated) {
      setUser({
        id: updated.user_id,
        nome: updated.user_nome,
        email: updated.user_email,
        telefone: updated.user_telefone,
        empresa: updated.user_empresa,
        avatar: updated.user_avatar,
        plano: updated.user_plano,
      });
    }
  };

  const addLead = async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'notes'>): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'Usuário não autenticado.' };
    }

    // Determina qual user_id usar para criar o lead
    // Se for membro, usa o user_id_empresa, senão usa o próprio id
    const userIdForLead = user.isMembro ? user.user_id_empresa : user.id;
    
    if (!userIdForLead) {
      return { success: false, error: 'Erro ao identificar usuário da empresa.' };
    }

    try {
      // Mapear os dados do lead para o formato do Supabase
      const supabaseLeadData: any = {
        lead_etapa: 'Entrada do lead',
        lead_status: 'Aberto',
        lead_nome_pessoa: leadData.leadName,
        lead_empresa: leadData.company || '',
        lead_telefone: leadData.phone,
        lead_email: leadData.email || '',
        lead_canal_origem: leadData.source,
        lead_notas: leadData.notes || '',
        user_id: userIdForLead,
        lead_nome_oportunidade: leadData.opportunityName,
      };
      
      // Se for membro com cargo 'Usuario', adiciona o membro_id
      if (user.isMembro && user.membro_cargo === 'Usuario' && user.membroId) {
        supabaseLeadData.membro_id = user.membroId;
      }

      // Adicionar no Supabase
      const { data, error } = await addLeadToSupabase(supabaseLeadData);
      
      if (error) {
        return { success: false, error: error.message };
      }

      // Recarregar os leads do Supabase para manter sincronização
      // Aplicar o mesmo filtro por membro_id se necessário
      let membroIdFilter: string | undefined;
      if (user.isMembro && user.membro_cargo === 'Usuario') {
        membroIdFilter = user.membroId;
      }
      
      const { data: updatedLeads, error: fetchError } = await getLeadsByUser(userIdForLead, membroIdFilter);
      
      if (fetchError || !updatedLeads) {
        return { success: false, error: 'Erro ao recarregar leads.' };
      }

      // Mapear os leads atualizados
      const mappedLeads: Lead[] = await Promise.all(updatedLeads.map(async (lead: any) => {
        const notes = await getNotesByLead(lead.lead_id?.toString() || '');
        
        return {
          id: lead.lead_id?.toString(),
          opportunityName: lead.lead_nome_oportunidade,
          leadName: lead.lead_nome_pessoa,
          email: lead.lead_email,
          phone: lead.lead_telefone,
          stage: mapLeadEtapaToStage(lead.lead_etapa),
          status: mapLeadStatus(lead.lead_status),
          createdAt: lead.created_at ? new Date(lead.created_at) : new Date(),
          updatedAt: lead.updated_at ? new Date(lead.updated_at) : new Date(),
          source: lead.lead_canal_origem,
          value: 0,
          notes: notes,
          priority: 'medium',
          expectedCloseDate: undefined,
          company: lead.lead_empresa,
        };
      }));

      setLeads(mappedLeads);
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
        return 'Ganho';
      default:
        return 'Aberto';
    }
  }

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    // Se o update for de etapa, atualizar no Supabase
    let supabaseUpdates: any = {};
    
    // Verificar se a etapa está sendo alterada para adicionar ao histórico
    if (updates.stage) {
      // Encontrar o lead atual para obter a etapa anterior
      const currentLead = leads.find(lead => lead.id === id);
      if (currentLead && currentLead.stage !== updates.stage) {
        // Mapear as etapas para nomes legíveis
        const etapaAnterior = mapStageToLeadEtapa(currentLead.stage);
        const novaEtapa = mapStageToLeadEtapa(updates.stage);
        
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
      
      supabaseUpdates.lead_etapa = mapStageToLeadEtapa(updates.stage);
    }
    
    if (updates.status) {
      if (updates.status === 'won') {
        supabaseUpdates.lead_status = 'Ganho';
      } else if (updates.status === 'lost') {
        supabaseUpdates.lead_status = 'Perdido';
      } else if (updates.status === 'active') {
        supabaseUpdates.lead_status = 'Aberto';
      }
    }

    if (updates.leadName) {
      supabaseUpdates.lead_nome_pessoa = updates.leadName;
    }
    if (updates.email) {
      supabaseUpdates.lead_email = updates.email;
    }
    if (updates.phone) {
      supabaseUpdates.lead_telefone = updates.phone;
    }
    if (updates.opportunityName) {
      supabaseUpdates.lead_nome_oportunidade = updates.opportunityName;
    }
    if (updates.source) {
      supabaseUpdates.lead_canal_origem = updates.source;
    }
    if (updates.expectedCloseDate) {
      supabaseUpdates.lead_data_fechamento_esperada = updates.expectedCloseDate instanceof Date ? updates.expectedCloseDate.toISOString() : updates.expectedCloseDate;
    }
    // Adicione outros campos se necessário
    if (Object.keys(supabaseUpdates).length > 0) {
      await updateLeadSupabase(id, supabaseUpdates);
      // Atualizar localmente também
      setLeads(prev => prev.map(lead => 
        lead.id === id 
          ? { ...lead, ...updates, updatedAt: new Date() }
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
      const notes: Note[] = (data || []).map((historico: any) => ({
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
      loadingUser,
      addLead,
      updateLead,
      deleteLead,
      addNote,
      getNotesByLead,
      login,
      register,
      logout,
      getDashboardMetrics,
      updateUser,
    }}>
      {children}
    </CRMContext.Provider>
  );
};
