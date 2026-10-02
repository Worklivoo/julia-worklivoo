import React, { useState, useEffect, useMemo } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Settings as SettingsIcon, Users, BookOpen, History, CreditCard, Package, Sparkles, Rocket } from 'lucide-react';
import { MembrosTab } from '@/pages/settings/MembrosTab';
import { AssinaturaTab } from '@/pages/settings/AssinaturaTab';
import { BaseConhecimentoTab } from '@/pages/settings/BaseConhecimentoTab';
import { usePersistentTab } from '@/hooks/use-persistent-state';
import { WhatsAppTab } from '@/pages/settings/WhatsAppTab';
import { EstoqueTab } from '@/pages/settings/EstoqueTab';
import { FollowUpDinamicoTab } from '@/pages/settings/FollowUpDinamicoTab';
import { FollowUpExtendidoTab } from '@/pages/settings/FollowUpExtendidoTab';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import SettingsTabsBar from '@/pages/settings/SettingsTabsBar';
import { GeraisTab } from '@/pages/settings/GeraisTab';
import { HistoricoOtimizacoesTab } from '@/pages/settings/HistoricoOtimizacoesTab';
import WhatsAppLogo from '@/pages/settings/WhatsAppLogo';
import { supabase } from '@/lib/supabase';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';
import { useSearchParams } from 'react-router-dom';

const Settings = () => {
  const { user } = useCRM();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = usePersistentTab('settings', 'followup-dinamico');
  const isAdmin = useMemo(() => {
    if (!user) return false;
    if (!user.isMembro) return true;
    return user.membro_tipo === 'Administrador';
  }, [user]);
  const settingsOwnerUserId = useMemo(() => {
    if (!user) return '';
    return user.isMembro ? (user.user_id_empresa || '') : user.id;
  }, [user]);

  useEffect(() => {
    const aba = searchParams.get('aba');
    if (!aba) return;
    const normalized = String(aba).trim().toLowerCase();
    if (!normalized) return;
    console.log('[Settings] Query param ?aba= detectado:', normalized);
    setActiveTab(normalized);
  }, [searchParams, setActiveTab]);

  const nonAdminAllowedTabs = useMemo(() => {
    return ['base-de-conhecimento', 'estoque-de-produtos', 'historico-de-otimizacoes'] as const;
  }, []);

  type RegrasFollowupDinamicoDB = {
    api_oficial: any;
    cliente_status: any;
    user_tipo: any;
  };
  const [regraFUDB, setRegraFUDB] = useState<RegrasFollowupDinamicoDB | null>(null);

  useEffect(() => {
    if (!settingsOwnerUserId) return;
    let cancelado = false;
    const carregar = async () => {
      try {
        const { data, error } = await supabase
          .from('usuarios_v2')
          .select('api_oficial, cliente_status, user_tipo')
          .eq('user_id', settingsOwnerUserId)
          .maybeSingle();
        if (cancelado) return;
        if (error) {
          console.warn('[FollowUp Dinamico] Erro ao carregar regras do banco:', error);
          return;
        }
        setRegraFUDB((data as RegrasFollowupDinamicoDB) ?? null);
      } catch (err) {
        if (cancelado) return;
        console.warn('[FollowUp Dinamico] Exceção carregar regras:', err);
      }
    };
    void carregar();
    return () => { cancelado = true; };
  }, [settingsOwnerUserId]);

  const regraFU = useMemo<RegrasFollowupDinamicoDB>(() => {
    if (regraFUDB) return regraFUDB;
    const u = user as any;
    return {
      api_oficial: u?.api_oficial,
      cliente_status: u?.cliente_status,
      user_tipo: u?.user_tipo,
    };
  }, [regraFUDB, user]);

  const canShowFollowupDinamico = useMemo(() => {
    if (!isAdmin) return false;
    const apiOficial = Boolean(regraFU.api_oficial);
    const clienteStatus = String(regraFU.cliente_status || '').trim().toUpperCase();
    const isNotTrial = clienteStatus !== 'TRIAL';
    const userTipo = String(regraFU.user_tipo || '').trim();
    const userTipoUpper = userTipo.toUpperCase();
    const isNotOutros = userTipoUpper !== 'OUTROS';
    const result = apiOficial === true && isNotTrial && isNotOutros;
    console.debug('[FollowUp Dinamico] Verificação de exibição:', {
      origem_campos: regraFUDB ? 'BANCO (usuarios_v2)' : 'CONTEXTO CRM (fallback)',
      user_id: user?.id,
      settingsOwnerUserId,
      isAdmin,
      api_oficial_raw: regraFU.api_oficial,
      apiOficial,
      cliente_status_raw: regraFU.cliente_status,
      clienteStatus,
      isNotTrial,
      user_tipo_raw: regraFU.user_tipo,
      userTipo,
      userTipoUpper,
      isNotOutros,
      pode_exibir: result,
    });
    return result;
  }, [isAdmin, regraFU, regraFUDB, user?.id, settingsOwnerUserId]);

  const canShowFollowupExtendido = useMemo(() => {
    if (!isAdmin) return false;
    const apiOficial = Boolean(regraFU.api_oficial);
    const clienteStatus = String(regraFU.cliente_status || '').trim().toUpperCase();
    const isNotTrial = clienteStatus !== 'TRIAL';
    const userTipo = String(regraFU.user_tipo || '').trim();
    const userTipoUpper = userTipo.toUpperCase();
    const isOutros = userTipoUpper === 'OUTROS';
    const result = apiOficial === true && isNotTrial && isOutros;
    console.debug('[FollowUp Extendido] Verificação de exibição:', {
      origem_campos: regraFUDB ? 'BANCO (usuarios_v2)' : 'CONTEXTO CRM (fallback)',
      user_id: user?.id,
      settingsOwnerUserId,
      isAdmin,
      api_oficial_raw: regraFU.api_oficial,
      apiOficial,
      cliente_status_raw: regraFU.cliente_status,
      clienteStatus,
      isNotTrial,
      user_tipo_raw: regraFU.user_tipo,
      userTipo,
      userTipoUpper,
      isOutros,
      pode_exibir: result,
    });
    return result;
  }, [isAdmin, regraFU, regraFUDB, user?.id, settingsOwnerUserId]);

  if (!user) {
    return (
      <div className="text-foreground transition-colors">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }

  const menuItems = [
    { id: 'followup-dinamico', label: 'FollowUp Dinamico', icon: Sparkles, highlight: true },
    { id: 'followup-extendido', label: 'FollowUp Extendido', icon: Rocket, highlight: true },
    { id: 'gerais', label: 'Gerais', icon: SettingsIcon },
    { id: 'membros', label: 'Membros', icon: Users },
    { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppLogo },
    { id: 'base-de-conhecimento', label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'estoque-de-produtos', label: 'Estoque de Produtos', icon: Package },
    { id: 'historico-de-otimizacoes', label: 'Histórico de Otimizações', icon: History },
    { id: 'assinatura', label: 'Assinatura', icon: CreditCard },
  ];

  const visibleMenuItems = useMemo(() => {
    const fullList = isAdmin ? menuItems : menuItems.filter((i) => new Set(nonAdminAllowedTabs).has(i.id as any));
    const filtered = fullList.filter((item) => {
      if ((item as any).id === 'followup-dinamico') return canShowFollowupDinamico;
      if ((item as any).id === 'followup-extendido') return canShowFollowupExtendido;
      return true;
    });
    console.debug('[FollowUp Dinamico/Extendido] Menu filtrado final:', {
      isAdmin,
      canShowFollowupDinamico,
      canShowFollowupExtendido,
      abas_visiveis: filtered.map((i) => i.id),
    });
    return filtered;
  }, [isAdmin, nonAdminAllowedTabs, canShowFollowupDinamico, canShowFollowupExtendido]);

  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      if (activeTab === 'followup-dinamico' && !canShowFollowupDinamico) {
        console.debug('[FollowUp Dinamico] Aba ativa inválida para este usuário. Redirecionando para "gerais".', {
          activeTab,
          canShowFollowupDinamico,
        });
        setActiveTab('gerais');
      }
      if (activeTab === 'followup-extendido' && !canShowFollowupExtendido) {
        console.debug('[FollowUp Extendido] Aba ativa inválida para este usuário. Redirecionando para "gerais".', {
          activeTab,
          canShowFollowupExtendido,
        });
        setActiveTab('gerais');
      }
      return;
    }
    if (nonAdminAllowedTabs.includes(activeTab as any)) return;
    setActiveTab('base-de-conhecimento');
  }, [activeTab, isAdmin, nonAdminAllowedTabs, setActiveTab, user, canShowFollowupDinamico, canShowFollowupExtendido]);

  return (
    <div className="wl-scope wl-page">
      <div className="wl-settings-body">
        <header className="wl-page__head wl-page__head--compact">
          <div>
            <p className="wl-eyebrow">Painel do cliente</p>
            <h1 className="wl-page__title">Configurações</h1>
            <p className="wl-lede">Gerencie suas preferências e fontes.</p>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="wl-settings-bar">
            <SettingsTabsBar items={visibleMenuItems as any} activeTab={activeTab} />
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pt-6">
            {isAdmin && (
              <TabsContent value="gerais" className="mt-0">
                <GeraisTab user={user} settingsOwnerUserId={settingsOwnerUserId} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="whatsapp" className="mt-0">
                <WhatsAppTab />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="membros" className="mt-0">
                <MembrosTab />
              </TabsContent>
            )}

            <TabsContent value="base-de-conhecimento" className="mt-0">
              <BaseConhecimentoTab />
            </TabsContent>

            <TabsContent value="estoque-de-produtos" className="mt-0">
              <EstoqueTab />
            </TabsContent>

            <TabsContent value="historico-de-otimizacoes" className="mt-0">
              <HistoricoOtimizacoesTab settingsOwnerUserId={settingsOwnerUserId} />
            </TabsContent>

            {isAdmin && (
              <TabsContent value="assinatura" className="mt-0">
                <AssinaturaTab />
              </TabsContent>
            )}

            {isAdmin && canShowFollowupDinamico && (
              <TabsContent value="followup-dinamico" className="mt-0">
                <FollowUpDinamicoTab user={user} settingsOwnerUserId={settingsOwnerUserId} />
              </TabsContent>
            )}

            {isAdmin && canShowFollowupExtendido && (
              <TabsContent value="followup-extendido" className="mt-0">
                <FollowUpExtendidoTab user={user} settingsOwnerUserId={settingsOwnerUserId} />
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
