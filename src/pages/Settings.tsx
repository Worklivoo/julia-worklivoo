import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/contexts/CRMContext';
import { User, Mail, Phone, Building, Crown, Hash, Settings as SettingsIcon, Database, Users, BookOpen, History, MessageCircle, Shuffle, Plus, X, KeyRound, FileText, Eye, EyeOff, CreditCard, Package, Star, Sparkles, Send, Rocket } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addFonteDados, getFontesDadosByUser, updateFonteDados, getTelefoneQualificadoByUser, updateTelefoneQualificadoByUser, getFeedbacksByUser, getLeadsWhatsappStatus, updateLeadsWhatsappStatus, getMensagemSaudacaoConfigByUser, updateMensagemSaudacaoConfigByUser, getFollowupConfigByUser, updateFollowupConfigByUser, getTransbordoFollowupStatusByUser, updateTransbordoFollowupStatusByUser, getTransbordoFollowupEtapasByUser, updateTransbordoFollowupEtapasByUser, getTransbordoFollowupMetodoConfigByUser, updateTransbordoFollowupMetodoConfigByUser, getGoogleAvaliacaoConfigByUser, updateGoogleAvaliacaoConfigByUser } from '@/lib/supabase-utils';
import { formatPhone } from '@/lib/lead-detail-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Membros from '@/pages/Membros';
import Assinatura from '@/pages/Assinatura';
import BaseDeConhecimento from './BaseDeConhecimento';
import { usePersistentTab } from '@/hooks/use-persistent-state';
import WhatsApp from '@/pages/WhatsApp';
import EstoqueDeProdutosTab from '@/pages/settings/EstoqueDeProdutosTab';
import { FollowUpDinamicoTab } from '@/pages/settings/FollowUpDinamicoTab';
import { FollowUpExtendidoTab } from '@/pages/settings/FollowUpExtendidoTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import termosHtml from '@/terms/termos-de-uso.html?raw';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useSearchParams } from 'react-router-dom';

const Settings = () => {
  const { user } = useCRM();
  const { toast } = useToast();
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

  const saudacaoModelosLojaDeCarros = [
    {
      id: 'mensagem_saudacao_padrao_1',
      titulo: 'Modelo 1',
      texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro, e estou entrando em contato para fazer o seu primeiro atendimento.

Você tem alguma dúvida especifica sobre o carro para que eu possa ajudar?`,
    },
    {
      id: 'mensagem_saudacao_padrao_2',
      titulo: 'Modelo 2',
      texto: `Olá, {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}! Tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Recebemos o seu cadastro mostrando interesse em um de nossos veículos. Estou aqui para agilizar seu atendimento e te passar todos os detalhes o mais rápido possível!

Para começarmos, o que você prefere: ver mais fotos do carro, entender as opções de financiamento ou tirar alguma dúvida específica?`,
    },
    {
      id: 'mensagem_saudacao_padrao_3',
      titulo: 'Modelo 3',
      texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro, e estou entrando em contato para fazer o seu primeiro atendimento.

Como posso te ajudar?`,
    },
    {
      id: 'mensagem_saudacao_padrao_4',
      titulo: 'Modelo 4',
      texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro.

Você tem alguma dúvida especifica sobre o carro?`,
    },
  ];
  const saudacaoModelosImobiliaria = [
    {
      id: 'mensagem_saudacao_padrao_imobiliaria_1',
      titulo: 'Modelo 1',
      texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um imóvel, e estou entrando em contato para fazer o seu primeiro atendimento.

Você tem alguma dúvida especifica que eu possa ajudar?`,
    },
    {
      id: 'mensagem_saudacao_padrao_imobiliaria_2',
      titulo: 'Modelo 2',
      texto: `Olá, {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}! Tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Recebemos o seu cadastro mostrando interesse em um de nossos imóveis. Estou aqui para agilizar seu atendimento e te passar todos os detalhes o mais rápido possível!

Para começarmos, o que você prefere: ver mais fotos ou tirar alguma dúvida específica?`,
    },
    {
      id: 'mensagem_saudacao_padrao_imobiliaria_3',
      titulo: 'Modelo 3',
      texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um imóvel, e estou entrando em contato para fazer o seu primeiro atendimento.

Como posso te ajudar?`,
    },
  ];
  const saudacaoModelos =
    String(user?.tipo || '').trim().toLowerCase() === 'imobiliaria' ? saudacaoModelosImobiliaria : saudacaoModelosLojaDeCarros;
  const saudacaoVariaveis = [
    {
      raw: "{{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}",
      label: '{{NOME}}',
    },
    {
      raw: "{{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}",
      label: '{{NOME DA EMPRESA}}',
    },
  ];
  const transbordoEtapasOptions = ['Entrada do lead', 'Tentando contato', 'Contato realizado'] as const;

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const renderSaudacaoTexto = (texto: string) => {
    const raw = String(texto || '');
    if (!raw) return raw;
    const pattern = new RegExp(`(${saudacaoVariaveis.map((v) => escapeRegExp(v.raw)).join('|')})`, 'g');
    return raw.split(pattern).map((part, idx) => {
      const variable = saudacaoVariaveis.find((v) => v.raw === part);
      if (!variable) return <React.Fragment key={idx}>{part}</React.Fragment>;
      return (
        <span key={idx} className="font-bold">
          {variable.label}
        </span>
      );
    });
  };
  const formatPhoneInput = (value: string) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.substring(2);
    }

    let formatted = digits;
    if (digits.length > 2) {
      formatted = `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
    }
    if (digits.length > 7) {
      formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
    }

    return formatted;
  };
  const normalizePhoneForStorage = (value: string) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length > 11) {
      digits = digits.substring(2);
    }

    return digits.length >= 10 ? `55${digits}` : '';
  };
  const parseStoredPhones = (value: string | null) =>
    String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((phone) => formatPhoneInput(phone));
  const [tipo, setTipo] = useState<string>('HTML');
  const [links, setLinks] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [isSubmittingFontes, setIsSubmittingFontes] = useState<boolean>(false);
  const [fontes, setFontes] = useState<any[]>([]);
  const [loadingFontes, setLoadingFontes] = useState<boolean>(false);
  const [fontesModalOpen, setFontesModalOpen] = useState<boolean>(false);
  const [fonteId, setFonteId] = useState<string | null>(null);
  const [telefoneQualificado, setTelefoneQualificado] = useState<string | null>(null);
  const [leadsWhatsappStatus, setLeadsWhatsappStatus] = useState<string>('Desativado');
  const [isSavingLeadsWhatsapp, setIsSavingLeadsWhatsapp] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(false);
  const [receiveMethod, setReceiveMethod] = useState<'whatsapp' | 'roleta'>('whatsapp');
  const [transbordoAtivado, setTransbordoAtivado] = useState<boolean>(false);
  const [transbordoMetodoAviso, setTransbordoMetodoAviso] = useState<'whatsapp' | 'roleta'>('whatsapp');
  const [loadingTransbordoStatus, setLoadingTransbordoStatus] = useState<boolean>(false);
  const [isSavingTransbordoStatus, setIsSavingTransbordoStatus] = useState<boolean>(false);
  const [transbordoEtapasOpen, setTransbordoEtapasOpen] = useState<boolean>(false);
  const [transbordoEtapasSelecionadas, setTransbordoEtapasSelecionadas] = useState<string[]>([]);
  const [transbordoEtapasDraft, setTransbordoEtapasDraft] = useState<string[]>([]);
  const [loadingTransbordoEtapas, setLoadingTransbordoEtapas] = useState<boolean>(false);
  const [isSavingTransbordoEtapas, setIsSavingTransbordoEtapas] = useState<boolean>(false);
  const [transbordoMetodoAvisoOpen, setTransbordoMetodoAvisoOpen] = useState<boolean>(false);
  const [transbordoMetodoAvisoDraft, setTransbordoMetodoAvisoDraft] = useState<'whatsapp' | 'roleta'>('whatsapp');
  const [transbordoTelefones, setTransbordoTelefones] = useState<string[]>([]);
  const [transbordoTelefonesDraft, setTransbordoTelefonesDraft] = useState<string[]>(['']);
  const [loadingTransbordoMetodoConfig, setLoadingTransbordoMetodoConfig] = useState<boolean>(false);
  const [isSavingTransbordoMetodoConfig, setIsSavingTransbordoMetodoConfig] = useState<boolean>(false);
  const [googleAvaliacaoAtiva, setGoogleAvaliacaoAtiva] = useState<boolean>(false);
  const [googleLinkAvaliacao, setGoogleLinkAvaliacao] = useState<string>('');
  const [googleLinkAvaliacaoSalvo, setGoogleLinkAvaliacaoSalvo] = useState<string>('');
  const [loadingGoogleAvaliacao, setLoadingGoogleAvaliacao] = useState<boolean>(false);
  const [isSavingGoogleAvaliacao, setIsSavingGoogleAvaliacao] = useState<boolean>(false);
  const [googleAvaliacaoModalOpen, setGoogleAvaliacaoModalOpen] = useState<boolean>(false);
  const [googleAvaliacaoPendingStatus, setGoogleAvaliacaoPendingStatus] = useState<boolean | null>(null);
  const [whatsappPhones, setWhatsappPhones] = useState<string[]>(['']);
  const [roletaPhones, setRoletaPhones] = useState<string[]>(['']);
  const [isSavingReceiveMethod, setIsSavingReceiveMethod] = useState<boolean>(false);
  const [receiveMethodModalOpen, setReceiveMethodModalOpen] = useState<boolean>(false);
  const [modoQualificacao, setModoQualificacao] = useState<string | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState<boolean>(false);
  const [termsOpen, setTermsOpen] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [mensagemSaudacaoPortal, setMensagemSaudacaoPortal] = useState<string>('');
  const [mensagemSaudacaoPortalSalva, setMensagemSaudacaoPortalSalva] = useState<string>('');
  const [idMensagemSaudacaoApiOficial, setIdMensagemSaudacaoApiOficial] = useState<string>('');
  const [idMensagemSaudacaoApiOficialSalvo, setIdMensagemSaudacaoApiOficialSalvo] = useState<string>('');
  const [isSavingMensagemSaudacao, setIsSavingMensagemSaudacao] = useState<boolean>(false);
  const [isEditingMensagemSaudacao, setIsEditingMensagemSaudacao] = useState<boolean>(false);
  const [frequenciaFollowup, setFrequenciaFollowup] = useState<string>('');
  const [frequenciaFollowupSalva, setFrequenciaFollowupSalva] = useState<string>('');
  const [quantidadeMaximaFollowup, setQuantidadeMaximaFollowup] = useState<string>('');
  const [quantidadeMaximaFollowupSalva, setQuantidadeMaximaFollowupSalva] = useState<string>('');
  const [loadingFrequenciaFollowup, setLoadingFrequenciaFollowup] = useState<boolean>(false);
  const [isSavingFrequenciaFollowup, setIsSavingFrequenciaFollowup] = useState<boolean>(false);
  const [isEditingFrequenciaFollowup, setIsEditingFrequenciaFollowup] = useState<boolean>(false);

  const getQualificacaoPhonesByMetodo = (method: 'whatsapp' | 'roleta') => {
    const modoLower = String(modoQualificacao || '').trim().toLowerCase();
    const shouldUseQualificacaoPhones =
      (method === 'roleta' && modoLower === 'roleta') ||
      (method === 'whatsapp' && modoLower === 'whatsapp');

    if (!shouldUseQualificacaoPhones) {
      return [];
    }

    return parseStoredPhones(telefoneQualificado);
  };

  const getTransbordoPhonesForMethod = (method: 'whatsapp' | 'roleta', options?: { preferQualificacao?: boolean }) => {
    const qualificacaoPhones = getQualificacaoPhonesByMetodo(method);
    const hasSavedPhonesForCurrentMethod = transbordoMetodoAviso === method && transbordoTelefones.length > 0;

    if (options?.preferQualificacao && qualificacaoPhones.length > 0) {
      return qualificacaoPhones;
    }

    if (hasSavedPhonesForCurrentMethod) {
      return transbordoTelefones;
    }

    if (qualificacaoPhones.length > 0) {
      return qualificacaoPhones;
    }

    return transbordoTelefones.length > 0 ? transbordoTelefones : [''];
  };

  const handleSaveReceiveMethod = async () => {
    if (!user || !settingsOwnerUserId) return;
    
    let finalValue = '';
    let modoQualificacao = 'Whatsapp';
    
    if (receiveMethod === 'whatsapp') {
      const validNumbers = whatsappPhones
        .map(phone => {
          const cleanPhone = phone.replace(/\D/g, '');
          return cleanPhone.length >= 10 ? `55${cleanPhone}` : '';
        })
        .filter(n => n !== '');

      if (validNumbers.length === 0) {
        toast({ title: 'Atenção', description: 'Por favor, insira pelo menos um número de WhatsApp válido.' });
        return;
      }

      finalValue = validNumbers.join(',');
      modoQualificacao = 'Whatsapp';
    } else if (receiveMethod === 'roleta') {
      const validNumbers = roletaPhones
        .map(phone => {
          const cleanPhone = phone.replace(/\D/g, '');
          return cleanPhone.length >= 10 ? `55${cleanPhone}` : '';
        })
        .filter(n => n !== '');

      if (validNumbers.length === 0) {
        toast({ title: 'Atenção', description: 'Por favor, insira pelo menos um número válido.' });
        return;
      }
      finalValue = validNumbers.join(',');
      modoQualificacao = 'Roleta';
    }

    setIsSavingReceiveMethod(true);
    const { error } = await updateTelefoneQualificadoByUser(settingsOwnerUserId, finalValue, modoQualificacao);
    setIsSavingReceiveMethod(false);

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível salvar a preferência.' });
      return;
    }

    setTelefoneQualificado(finalValue);
    setModoQualificacao(modoQualificacao);
    setReceiveMethodModalOpen(false);
    toast({ title: 'Sucesso', description: 'Preferência de recebimento salva com sucesso!' });
  };

  const openFontesModal = () => {
    const existing = fontes?.[0];
    if (existing) {
      setFonteId(existing.id || null);
      setTipo(existing.tipo || 'HTML');
      setLinks(existing.link || '');
      setBody(existing.body || '');
    } else {
      setFonteId(null);
      setTipo('HTML');
      setLinks('');
      setBody('');
    }
    setFontesModalOpen(true);
  };

  const handleSaveFonteDados = async () => {
    if (!user || !settingsOwnerUserId) return;

    if (tipo === 'INTERNO') {
      setIsSubmittingFontes(true);
      const { data, error } = await supabase
        .from('usuarios_v2')
        .update({ scrapper_tipo: 'INTERNO' })
        .eq('user_id', settingsOwnerUserId)
        .select('user_id, user_empresa, scrapper_tipo, scrapper_link, scrapper_body')
        .single();
      setIsSubmittingFontes(false);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: 'Verifique os dados e tente novamente.' });
        return;
      }

      const normalized = {
        id: data.user_id,
        tipo: data.scrapper_tipo ?? 'HTML',
        link: data.scrapper_link ?? '',
        body: data.scrapper_body ?? null,
        cliente: data.user_empresa ?? null,
      };

      setFontes([normalized]);
      setFonteId(normalized.id || null);
      await triggerFontesWebhook({ userId: settingsOwnerUserId });
      setFontesModalOpen(false);
      toast({ title: 'Fonte de dados atualizada', description: 'As informações foram alteradas.' });
      return;
    }

    const normalizedLinks =
      tipo === 'XML'
        ? links.trim()
        : links
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .join('\n');

    setIsSubmittingFontes(true);

    if (fonteId) {
      const { data, error } = await updateFonteDados(settingsOwnerUserId, {
        tipo,
        link: normalizedLinks,
        body: tipo === 'API' && body ? body : null,
      });
      setIsSubmittingFontes(false);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: 'Verifique os dados e tente novamente.' });
        return;
      }
      setFontes((prev) => prev.map((f) => (f.id === data.id ? data : f)));
      await triggerFontesWebhook({ userId: settingsOwnerUserId });
      setFontesModalOpen(false);
      toast({ title: 'Fonte de dados atualizada', description: 'As informações foram alteradas.' });
      return;
    }

    const result = await addFonteDados({
      tipo,
      link: normalizedLinks,
      body: tipo === 'API' && body ? body : null,
      user_id: settingsOwnerUserId,
    });
    setIsSubmittingFontes(false);
    if (result.error) {
      toast({ title: 'Erro ao salvar', description: 'Verifique os dados e tente novamente.' });
      return;
    }
    toast({ title: 'Fonte de dados salva', description: 'As informações foram registradas.' });
    await triggerFontesWebhook({ userId: settingsOwnerUserId });
    setFontes([result.data]);
    setFonteId(result.data?.id || null);
    setFontesModalOpen(false);
  };

  const handleChangePassword = async () => {
    const nextPassword = newPassword.trim();
    const nextConfirm = confirmPassword.trim();

    if (nextPassword.length < 6) {
      toast({ title: 'Atenção', description: 'A senha precisa ter pelo menos 6 caracteres.' });
      return;
    }
    if (nextPassword !== nextConfirm) {
      toast({ title: 'Atenção', description: 'As senhas não coincidem.' });
      return;
    }

    setIsSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: nextPassword });
    setIsSavingPassword(false);
    if (error) {
      toast({ title: 'Erro', description: error.message || 'Não foi possível alterar a senha.' });
      return;
    }

    setChangePasswordOpen(false);
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    toast({ title: 'Senha atualizada', description: 'Sua senha foi alterada com sucesso.' });
  };
  useEffect(() => {
    setCliente(user?.empresa || '');
  }, [user?.empresa]);

  useEffect(() => {
    const loadTelefone = async () => {
      if (!settingsOwnerUserId) return;
      const { data, modo } = await getTelefoneQualificadoByUser(settingsOwnerUserId);
      setTelefoneQualificado(data || null);
      setModoQualificacao(modo || null);
      
      if (modo) {
                const modoLower = modo.toLowerCase();
                if (modoLower === 'roleta') {
                  setReceiveMethod('roleta');
                  if (data) {
                    const arr = data.split(',').map(n => {
                      let num = n.replace(/\D/g, '');
                      if (num.startsWith('55')) num = num.substring(2);
                      let formatted = num;
                      if (num.length > 2) formatted = `(${num.substring(0, 2)}) ${num.substring(2)}`;
                      if (num.length > 7) formatted = `(${num.substring(0, 2)}) ${num.substring(2, 7)}-${num.substring(7, 11)}`;
                      return formatted;
                    });
                    setRoletaPhones(arr.length > 0 ? arr : ['']);
                  } else {
                    setRoletaPhones(['']);
                  }
                } else {
                  setReceiveMethod('whatsapp');
                  if (data) {
                    const arr = data
                      .split(',')
                      .map((n) => n.trim())
                      .filter(Boolean)
                      .map((n) => {
                        let num = n.replace(/\D/g, '');
                        if (num.startsWith('55')) num = num.substring(2);
                        let formatted = num;
                        if (num.length > 2) formatted = `(${num.substring(0, 2)}) ${num.substring(2)}`;
                        if (num.length > 7) formatted = `(${num.substring(0, 2)}) ${num.substring(2, 7)}-${num.substring(7, 11)}`;
                        return formatted;
                      });
                    setWhatsappPhones(arr.length > 0 ? arr : ['']);
                  } else {
                    setWhatsappPhones(['']);
                  }
                }
              } else if (data) {
        // Fallback legado caso modo seja null
        if (data.includes('http')) {
          setReceiveMethod('whatsapp');
          setWhatsappPhones(['']);
        } else if (data.includes(',')) {
          setReceiveMethod('roleta');
          const arr = data.split(',').map(n => {
            let num = n.replace(/\D/g, '');
            if (num.startsWith('55')) num = num.substring(2);
            let formatted = num;
            if (num.length > 2) formatted = `(${num.substring(0, 2)}) ${num.substring(2)}`;
            if (num.length > 7) formatted = `(${num.substring(0, 2)}) ${num.substring(2, 7)}-${num.substring(7, 11)}`;
            return formatted;
          });
          setRoletaPhones(arr.length > 0 ? arr : ['']);
        } else {
          setReceiveMethod('whatsapp');
          // Formatar número ao carregar, se houver
          let num = data.replace(/\D/g, '');
          if (num.startsWith('55')) num = num.substring(2);
          let formatted = num;
          if (num.length > 2) formatted = `(${num.substring(0, 2)}) ${num.substring(2)}`;
          if (num.length > 7) formatted = `(${num.substring(0, 2)}) ${num.substring(2, 7)}-${num.substring(7, 11)}`;
          setWhatsappPhones([formatted]);
        }
      }
    };
    loadTelefone();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFontes(true);
      const { data } = await getFontesDadosByUser(settingsOwnerUserId);
      setFontes(data || []);
      setLoadingFontes(false);
    };
    load();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const loadLeadsWhatsapp = async () => {
      if (!user) return;
      const userIdForWhatsapp = user.isMembro ? user.user_id_empresa : user.id;
      if (!userIdForWhatsapp) return;
      const { data } = await getLeadsWhatsappStatus(userIdForWhatsapp);
      setLeadsWhatsappStatus(data || 'Desativado');
    };
    loadLeadsWhatsapp();
  }, [user?.id]);

  useEffect(() => {
    const loadMensagemSaudacao = async () => {
      if (!user || !settingsOwnerUserId) return;
      const { data } = await getMensagemSaudacaoConfigByUser(settingsOwnerUserId);
      const savedId = data?.id_mensagem_saudacao_api_oficial_whatsapp ?? '';
      const savedMsg = data?.mensagem_saudacao_portal ?? '';
      const isTipoOutros = String(user?.tipo || '').trim().toLowerCase() === 'outros';
      const fromModel = !isTipoOutros && savedId ? saudacaoModelos.find((m) => m.id === savedId)?.texto || '' : '';
      const nextMsg = isTipoOutros ? savedMsg : savedMsg || fromModel;

      setMensagemSaudacaoPortal(nextMsg);
      setMensagemSaudacaoPortalSalva(nextMsg);
      setIdMensagemSaudacaoApiOficial(savedId);
      setIdMensagemSaudacaoApiOficialSalvo(savedId);
      setIsEditingMensagemSaudacao(false);
    };
    loadMensagemSaudacao();
  }, [settingsOwnerUserId, user?.tipo]);

  useEffect(() => {
    const loadFrequenciaFollowup = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFrequenciaFollowup(true);
      const { data } = await getFollowupConfigByUser(settingsOwnerUserId);
      const nextFreq =
        data?.frequencia_followup === null || data?.frequencia_followup === undefined ? '' : String(data.frequencia_followup);
      const nextQtd =
        data?.quantidade_maxima_followup === null || data?.quantidade_maxima_followup === undefined
          ? ''
          : String(data.quantidade_maxima_followup);
      setFrequenciaFollowup(nextFreq);
      setFrequenciaFollowupSalva(nextFreq);
      setQuantidadeMaximaFollowup(nextQtd);
      setQuantidadeMaximaFollowupSalva(nextQtd);
      setIsEditingFrequenciaFollowup(false);
      setLoadingFrequenciaFollowup(false);
    };
    loadFrequenciaFollowup();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const loadTransbordoFollowupStatus = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingTransbordoStatus(true);
      const { data } = await getTransbordoFollowupStatusByUser(settingsOwnerUserId);
      setTransbordoAtivado(Boolean(data));
      setLoadingTransbordoStatus(false);
    };
    loadTransbordoFollowupStatus();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const loadTransbordoFollowupEtapas = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingTransbordoEtapas(true);
      const { data } = await getTransbordoFollowupEtapasByUser(settingsOwnerUserId);
      const etapas = String(data || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => transbordoEtapasOptions.includes(item as typeof transbordoEtapasOptions[number]));
      setTransbordoEtapasSelecionadas(etapas);
      setTransbordoEtapasDraft(etapas);
      setLoadingTransbordoEtapas(false);
    };
    loadTransbordoFollowupEtapas();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const loadTransbordoFollowupMetodoConfig = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingTransbordoMetodoConfig(true);
      const { data } = await getTransbordoFollowupMetodoConfigByUser(settingsOwnerUserId);
      const metodo = String(data?.transbordo_followup_metodo || '').trim().toLowerCase() === 'roleta' ? 'roleta' : 'whatsapp';
      const telefones = parseStoredPhones(data?.transbordo_followup_telefones ?? null);

      setTransbordoMetodoAviso(metodo);
      setTransbordoMetodoAvisoDraft(metodo);
      setTransbordoTelefones(telefones);
      setTransbordoTelefonesDraft(telefones.length > 0 ? telefones : ['']);
      setLoadingTransbordoMetodoConfig(false);
    };
    loadTransbordoFollowupMetodoConfig();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const loadGoogleAvaliacaoConfig = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingGoogleAvaliacao(true);
      const { data } = await getGoogleAvaliacaoConfigByUser(settingsOwnerUserId);
      const ativo = Boolean(data?.google_avaliacao);
      const link = String(data?.google_link_avaliacao || '').trim();
      setGoogleAvaliacaoAtiva(ativo);
      setGoogleLinkAvaliacao(link);
      setGoogleLinkAvaliacaoSalvo(link);
      setLoadingGoogleAvaliacao(false);
    };
    loadGoogleAvaliacaoConfig();
  }, [settingsOwnerUserId]);

  useEffect(() => {
    if (loadingTransbordoMetodoConfig) return;
    if (transbordoTelefones.length > 0) return;

    const qualificacaoPhones = getQualificacaoPhonesByMetodo(transbordoMetodoAviso);
    if (qualificacaoPhones.length === 0) return;

    setTransbordoTelefones(qualificacaoPhones);
    setTransbordoTelefonesDraft(qualificacaoPhones);
  }, [loadingTransbordoMetodoConfig, transbordoMetodoAviso, transbordoTelefones.length, telefoneQualificado, modoQualificacao]);

  useEffect(() => {
    const loadFeedbacks = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFeedbacks(true);
      const { data } = await getFeedbacksByUser(settingsOwnerUserId);
      const negatives = (data || []).filter((f: any) => String(f?.comentario_tipo || '').toLowerCase() === 'negativo');
      setFeedbacks(negatives);
      setLoadingFeedbacks(false);
    };
    loadFeedbacks();
  }, [settingsOwnerUserId]);

  if (!user) {
    return (
      <div className="text-foreground transition-colors">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }

  const isTipoOutros = String(user?.tipo || '').trim().toLowerCase() === 'outros';

  const getPlanoBadge = (plano: string | null) => {
    if (plano === null || plano === undefined || plano === '') {
      return <Badge variant="outline">Não definido</Badge>;
    }
    const num = Number(plano);
    if (Number.isNaN(num)) {
      return <Badge variant="outline">Não definido</Badge>;
    }
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
        {num} Lead{num !== 1 ? 's' : ''}
      </Badge>
    );
  };

  const handleSelectMensagemSaudacaoModelo = async (params: { id: string; texto: string }) => {
    if (!user) return;
    setIsSavingMensagemSaudacao(true);
    const { error } = await updateMensagemSaudacaoConfigByUser(user.id, {
      mensagem_saudacao_portal: params.texto,
      id_mensagem_saudacao_api_oficial_whatsapp: params.id,
    });
    setIsSavingMensagemSaudacao(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar a mensagem de saudação.' });
      return;
    }
    setMensagemSaudacaoPortal(params.texto);
    setMensagemSaudacaoPortalSalva(params.texto);
    setIdMensagemSaudacaoApiOficial(params.id);
    setIdMensagemSaudacaoApiOficialSalvo(params.id);
    setIsEditingMensagemSaudacao(false);
    toast({ title: 'Salvo', description: 'Mensagem de saudação atualizada.' });
  };

  const handleSaveFrequenciaFollowup = async () => {
    if (!user) return;
    const minFreq = user.api_oficial ? 1 : 6;
    const maxFreq = user.api_oficial ? 8 : 36;
    const rawFreq = frequenciaFollowup.trim();
    const parsedFreq = Number(rawFreq);
    const freqInt = Number.isFinite(parsedFreq) ? Math.trunc(parsedFreq) : NaN;

    const rawQtd = quantidadeMaximaFollowup.trim();
    const parsedQtd = Number(rawQtd);
    const qtdInt = Number.isFinite(parsedQtd) ? Math.trunc(parsedQtd) : NaN;

    if (!rawFreq || Number.isNaN(freqInt) || freqInt < minFreq || freqInt > maxFreq) {
      toast({ title: 'Atenção', description: `Selecione uma frequência válida entre ${minFreq} e ${maxFreq} horas.` });
      return;
    }
    if (!rawQtd || Number.isNaN(qtdInt) || qtdInt < 1 || qtdInt > 3) {
      toast({ title: 'Atenção', description: 'Selecione uma quantidade válida entre 1 e 3.' });
      return;
    }
    setIsSavingFrequenciaFollowup(true);
    const { error } = await updateFollowupConfigByUser(user.id, {
      frequencia_followup: freqInt,
      quantidade_maxima_followup: qtdInt,
    });
    setIsSavingFrequenciaFollowup(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar o fluxo de follow up.' });
      return;
    }
    const savedFreq = String(freqInt);
    const savedQtd = String(qtdInt);
    setFrequenciaFollowup(savedFreq);
    setFrequenciaFollowupSalva(savedFreq);
    setQuantidadeMaximaFollowup(savedQtd);
    setQuantidadeMaximaFollowupSalva(savedQtd);
    setIsEditingFrequenciaFollowup(false);
    toast({ title: 'Salvo', description: 'Fluxo de follow up atualizado.' });
  };

  const handleToggleTransbordoStatus = async (checked: boolean) => {
    if (!settingsOwnerUserId) return;

    const previousStatus = transbordoAtivado;
    setTransbordoAtivado(checked);
    setIsSavingTransbordoStatus(true);

    const { error } = await updateTransbordoFollowupStatusByUser(settingsOwnerUserId, checked);

    setIsSavingTransbordoStatus(false);

    if (error) {
      setTransbordoAtivado(previousStatus);
      toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar o status do transbordo.' });
      return;
    }

    toast({
      title: 'Status atualizado',
      description: `Transbordo de follow up ${checked ? 'ativado' : 'desativado'}.`,
    });
  };

  const handleSaveTransbordoEtapas = async () => {
    if (!settingsOwnerUserId) return;

    setIsSavingTransbordoEtapas(true);

    const etapasValue = transbordoEtapasDraft.length > 0 ? transbordoEtapasDraft.join(',') : null;
    const { error } = await updateTransbordoFollowupEtapasByUser(settingsOwnerUserId, etapasValue);

    setIsSavingTransbordoEtapas(false);

    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Nao foi possivel salvar as etapas do lead.' });
      return;
    }

    setTransbordoEtapasSelecionadas(transbordoEtapasDraft);
    setTransbordoEtapasOpen(false);
    toast({ title: 'Salvo', description: 'Etapas do lead atualizadas.' });
  };

  const handleSaveTransbordoMetodoConfig = async () => {
    if (!settingsOwnerUserId) return;

    const validNumbers = transbordoTelefonesDraft
      .map((phone) => normalizePhoneForStorage(phone))
      .filter((phone) => phone !== '');

    if (validNumbers.length === 0) {
      toast({ title: 'Atenção', description: 'Por favor, insira pelo menos um número válido.' });
      return;
    }

    setIsSavingTransbordoMetodoConfig(true);

    const metodoValue = transbordoMetodoAvisoDraft === 'whatsapp' ? 'WhatsApp' : 'Roleta';
    const telefonesValue = validNumbers.join(',');
    const { error } = await updateTransbordoFollowupMetodoConfigByUser(settingsOwnerUserId, {
      transbordo_followup_metodo: metodoValue,
      transbordo_followup_telefones: telefonesValue,
    });

    setIsSavingTransbordoMetodoConfig(false);

    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar o método de aviso.' });
      return;
    }

    const formattedPhones = validNumbers.map((phone) => formatPhoneInput(phone));
    setTransbordoMetodoAviso(transbordoMetodoAvisoDraft);
    setTransbordoTelefones(formattedPhones);
    setTransbordoTelefonesDraft(formattedPhones.length > 0 ? formattedPhones : ['']);
    setTransbordoMetodoAvisoOpen(false);
    toast({ title: 'Salvo', description: 'Método de aviso atualizado.' });
  };

  const isValidGoogleAvaliacaoLink = (value: string) => {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  };

  const handleToggleGoogleAvaliacao = async (checked: boolean) => {
    if (!settingsOwnerUserId) return;

    const savedLink = googleLinkAvaliacaoSalvo.trim();

    if (checked && !savedLink) {
      setGoogleAvaliacaoPendingStatus(true);
      setGoogleLinkAvaliacao(savedLink);
      setGoogleAvaliacaoModalOpen(true);
      toast({ title: 'Atenção', description: 'Informe o link do Google Avaliação para ativar a funcionalidade.' });
      return;
    }

    setIsSavingGoogleAvaliacao(true);
    const { error } = await updateGoogleAvaliacaoConfigByUser(settingsOwnerUserId, {
      google_avaliacao: checked,
      google_link_avaliacao: savedLink || null,
    });
    setIsSavingGoogleAvaliacao(false);

    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar a configuração do Google Avaliação.' });
      return;
    }

    setGoogleAvaliacaoAtiva(checked);
    setGoogleAvaliacaoPendingStatus(null);
    toast({ title: 'Salvo', description: 'Google Avaliação atualizado.' });
  };

  const handleSaveGoogleAvaliacao = async () => {
    if (!settingsOwnerUserId) return;

    const normalizedLink = googleLinkAvaliacao.trim();
    const nextStatus = googleAvaliacaoPendingStatus ?? googleAvaliacaoAtiva;

    if (nextStatus) {
      if (!normalizedLink) {
        toast({ title: 'Atenção', description: 'Informe o link do Google Avaliação para ativar a funcionalidade.' });
        return;
      }

      if (!isValidGoogleAvaliacaoLink(normalizedLink)) {
        toast({ title: 'Atenção', description: 'Informe um link válido do Google Avaliação.' });
        return;
      }
    }

    setIsSavingGoogleAvaliacao(true);
    const { error } = await updateGoogleAvaliacaoConfigByUser(settingsOwnerUserId, {
      google_avaliacao: nextStatus,
      google_link_avaliacao: normalizedLink || null,
    });
    setIsSavingGoogleAvaliacao(false);

    if (error) {
      toast({ title: 'Erro ao salvar', description: 'Não foi possível salvar a configuração do Google Avaliação.' });
      return;
    }

    setGoogleAvaliacaoAtiva(nextStatus);
    setGoogleLinkAvaliacao(normalizedLink);
    setGoogleLinkAvaliacaoSalvo(normalizedLink);
    setGoogleAvaliacaoPendingStatus(null);
    setGoogleAvaliacaoModalOpen(false);
    toast({ title: 'Salvo', description: 'Google Avaliação atualizado.' });
  };

  const triggerFontesWebhook = async (params: { userId: string }) => {
    const userTipo = String(user?.tipo || '').trim().toLowerCase();
    const url =
      userTipo === 'imobiliaria'
        ? 'https://primary-production-d442.up.railway.app/webhook/7db085f5-1f3b-4437-ae7d-6986322da4b4'
        : 'https://primary-production-d442.up.railway.app/webhook/nfdbgfdj996banco-dados-135b490d';
    const payload: any = { user_id: params.userId };
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        toast({ title: 'Webhook falhou', description: text || `Status ${res.status}` });
      }
    } catch (err: any) {
      toast({ title: 'Erro no webhook', description: err?.message || 'Falha ao enviar' });
    }
  };

  const WhatsAppLogo = ({ size = 16, className = '' }: { size?: number; className?: string }) => (
    <WhatsAppIcon sx={{ width: size + 2, height: size + 2, display: 'block' }} className={className} />
  );

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
    <div className="h-full bg-background transition-colors">
      <div className="flex h-full w-full flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent light-welcome-title">Configurações</h1>
            <p className="text-muted-foreground mt-1 text-lg">Gerencie suas preferências e fontes</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-10 py-3 bg-background/80 backdrop-blur border-b border-border min-h-0 overflow-y-hidden">
            <TabsList className="w-full h-auto min-h-0 justify-start rounded-xl bg-muted/40 p-1 overflow-y-hidden overflow-x-auto flex-nowrap">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isHighlight = Boolean((item as any).highlight);
                return (
                  <TabsTrigger
                    key={item.id}
                    value={item.id}
                    className={`gap-2 rounded-lg px-4 shrink-0 h-9 ${
                      isHighlight
                        ? 'relative bg-gradient-to-r from-amber-400/20 via-orange-500/20 to-rose-500/20 border border-amber-300/40 text-foreground font-semibold shadow-[0_0_0_1px_rgba(251,191,36,0.15),0_6px_20px_-8px_rgba(251,146,60,0.45)] hover:from-amber-400/30 hover:via-orange-500/30 hover:to-rose-500/30'
                        : ''
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 ${isHighlight ? 'text-orange-600 dark:text-amber-400' : ''}`} />
                    <span className={`whitespace-nowrap ${isHighlight ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 bg-clip-text text-transparent dark:from-amber-300 dark:via-orange-300 dark:to-rose-300' : ''}`}>
                      {item.label}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <Dialog open={receiveMethodModalOpen} onOpenChange={setReceiveMethodModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {receiveMethod === 'whatsapp' && 'Configurar WhatsApp'}
                  {receiveMethod === 'roleta' && 'Configurar Roleta'}
                </DialogTitle>
                <DialogDescription>
                  {receiveMethod === 'whatsapp' && 'Insira o número do WhatsApp para receber os leads.'}
                  {receiveMethod === 'roleta' && 'Insira os números de telefone, um por linha. Os leads serão distribuídos entre eles.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={receiveMethod === 'whatsapp' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReceiveMethod('whatsapp')}
                    className="h-8 rounded-xl"
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant={receiveMethod === 'roleta' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setReceiveMethod('roleta')}
                    className="h-8 rounded-xl"
                  >
                    Roleta
                  </Button>
                </div>

                {receiveMethod === 'whatsapp' && (
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {whatsappPhones.map((phone, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-shrink-0 flex items-center justify-center bg-muted px-3 rounded-md border border-input text-muted-foreground font-medium h-10">
                          +55
                        </div>
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            let formatted = val;
                            if (val.length > 2) {
                              formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                            }
                            if (val.length > 7) {
                              formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`;
                            }
                            const newPhones = [...whatsappPhones];
                            newPhones[index] = formatted;
                            setWhatsappPhones(newPhones);
                          }}
                          placeholder="(11) 99999-9999"
                          className="flex-1 bg-background h-10"
                          maxLength={15}
                        />
                        {whatsappPhones.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newPhones = [...whatsappPhones];
                              newPhones.splice(index, 1);
                              setWhatsappPhones(newPhones);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit flex items-center gap-2"
                      onClick={() => setWhatsappPhones([...whatsappPhones, ''])}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar novo número
                    </Button>
                  </div>
                )}

                {receiveMethod === 'roleta' && (
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {roletaPhones.map((phone, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-shrink-0 flex items-center justify-center bg-muted px-3 rounded-md border border-input text-muted-foreground font-medium h-10">
                          +55
                        </div>
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            let formatted = val;
                            if (val.length > 2) {
                              formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
                            }
                            if (val.length > 7) {
                              formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`;
                            }
                            const newPhones = [...roletaPhones];
                            newPhones[index] = formatted;
                            setRoletaPhones(newPhones);
                          }}
                          placeholder="(11) 99999-9999"
                          className="flex-1 bg-background h-10"
                          maxLength={15}
                        />
                        {roletaPhones.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newPhones = [...roletaPhones];
                              newPhones.splice(index, 1);
                              setRoletaPhones(newPhones);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit flex items-center gap-2"
                      onClick={() => setRoletaPhones([...roletaPhones, ''])}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar novo número
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveReceiveMethod} disabled={isSavingReceiveMethod}>
                  {isSavingReceiveMethod ? 'Salvando...' : 'Salvar Preferência'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={transbordoEtapasOpen}
            onOpenChange={(open) => {
              setTransbordoEtapasOpen(open);
              if (open) {
                setTransbordoEtapasDraft(transbordoEtapasSelecionadas);
              }
            }}
          >
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Etapas do Lead</DialogTitle>
                <DialogDescription>Selecione em quais etapas o transbordo de follow up deve considerar o lead.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 py-2">
                {transbordoEtapasOptions.map((etapa) => {
                  const isSelected = transbordoEtapasDraft.includes(etapa);
                  return (
                    <Button
                      key={etapa}
                      type="button"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={() => {
                        setTransbordoEtapasDraft((prev) =>
                          prev.includes(etapa) ? prev.filter((item) => item !== etapa) : [...prev, etapa]
                        );
                      }}
                      className="h-auto justify-start rounded-2xl px-4 py-3 text-left"
                    >
                      {etapa}
                    </Button>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransbordoEtapasDraft(transbordoEtapasSelecionadas);
                    setTransbordoEtapasOpen(false);
                  }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveTransbordoEtapas} disabled={isSavingTransbordoEtapas} className="rounded-xl">
                  {isSavingTransbordoEtapas ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={transbordoMetodoAvisoOpen}
            onOpenChange={(open) => {
              setTransbordoMetodoAvisoOpen(open);
              if (open) {
                setTransbordoMetodoAvisoDraft(transbordoMetodoAviso);
                setTransbordoTelefonesDraft(getTransbordoPhonesForMethod(transbordoMetodoAviso, { preferQualificacao: true }));
              }
            }}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {transbordoMetodoAvisoDraft === 'whatsapp' && 'Configurar WhatsApp'}
                  {transbordoMetodoAvisoDraft === 'roleta' && 'Configurar Roleta'}
                </DialogTitle>
                <DialogDescription>
                  Escolha como a equipe deve ser avisada quando o transbordo de follow up acontecer.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant={transbordoMetodoAvisoDraft === 'whatsapp' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setTransbordoMetodoAvisoDraft('whatsapp');
                      setTransbordoTelefonesDraft(getTransbordoPhonesForMethod('whatsapp', { preferQualificacao: true }));
                    }}
                    className="h-8 rounded-xl"
                  >
                    WhatsApp
                  </Button>
                  <Button
                    type="button"
                    variant={transbordoMetodoAvisoDraft === 'roleta' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setTransbordoMetodoAvisoDraft('roleta');
                      setTransbordoTelefonesDraft(getTransbordoPhonesForMethod('roleta', { preferQualificacao: true }));
                    }}
                    className="h-8 rounded-xl"
                  >
                    Roleta
                  </Button>
                </div>

                {transbordoMetodoAvisoDraft === 'whatsapp' && (
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {transbordoTelefonesDraft.map((phone, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-shrink-0 flex items-center justify-center bg-muted px-3 rounded-md border border-input text-muted-foreground font-medium h-10">
                          +55
                        </div>
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const newPhones = [...transbordoTelefonesDraft];
                            newPhones[index] = formatPhoneInput(e.target.value);
                            setTransbordoTelefonesDraft(newPhones);
                          }}
                          placeholder="(11) 99999-9999"
                          className="flex-1 bg-background h-10"
                          maxLength={15}
                        />
                        {transbordoTelefonesDraft.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newPhones = [...transbordoTelefonesDraft];
                              newPhones.splice(index, 1);
                              setTransbordoTelefonesDraft(newPhones.length > 0 ? newPhones : ['']);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit flex items-center gap-2"
                      onClick={() => setTransbordoTelefonesDraft([...transbordoTelefonesDraft, ''])}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar novo número
                    </Button>
                  </div>
                )}

                {transbordoMetodoAvisoDraft === 'roleta' && (
                  <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {transbordoTelefonesDraft.map((phone, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <div className="flex-shrink-0 flex items-center justify-center bg-muted px-3 rounded-md border border-input text-muted-foreground font-medium h-10">
                          +55
                        </div>
                        <Input
                          value={phone}
                          onChange={(e) => {
                            const newPhones = [...transbordoTelefonesDraft];
                            newPhones[index] = formatPhoneInput(e.target.value);
                            setTransbordoTelefonesDraft(newPhones);
                          }}
                          placeholder="(11) 99999-9999"
                          className="flex-1 bg-background h-10"
                          maxLength={15}
                        />
                        {transbordoTelefonesDraft.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              const newPhones = [...transbordoTelefonesDraft];
                              newPhones.splice(index, 1);
                              setTransbordoTelefonesDraft(newPhones.length > 0 ? newPhones : ['']);
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 w-fit flex items-center gap-2"
                      onClick={() => setTransbordoTelefonesDraft([...transbordoTelefonesDraft, ''])}
                    >
                      <Plus className="h-4 w-4" />
                      Adicionar novo número
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setTransbordoMetodoAvisoDraft(transbordoMetodoAviso);
                    setTransbordoTelefonesDraft(getTransbordoPhonesForMethod(transbordoMetodoAviso));
                    setTransbordoMetodoAvisoOpen(false);
                  }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveTransbordoMetodoConfig} disabled={isSavingTransbordoMetodoConfig} className="rounded-xl">
                  {isSavingTransbordoMetodoConfig ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={googleAvaliacaoModalOpen}
            onOpenChange={(open) => {
              setGoogleAvaliacaoModalOpen(open);
              if (open) {
                setGoogleLinkAvaliacao(googleLinkAvaliacaoSalvo);
                return;
              }
              setGoogleAvaliacaoPendingStatus(null);
              setGoogleLinkAvaliacao(googleLinkAvaliacaoSalvo);
            }}
          >
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>Google Avaliação</DialogTitle>
                <DialogDescription>Edite o link que a IA deve enviar quando o lead for qualificado.</DialogDescription>
              </DialogHeader>

              <div className="space-y-2 py-2">
                <div className="text-xs text-muted-foreground">Link do Google Avaliação</div>
                <Input
                  type="url"
                  value={googleLinkAvaliacao}
                  onChange={(e) => setGoogleLinkAvaliacao(e.target.value)}
                  className="bg-background border-border rounded-2xl"
                  placeholder="https://g.page/r/..."
                />
                <div className="text-xs text-muted-foreground">
                  Obrigatório quando a funcionalidade estiver ativada.
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setGoogleLinkAvaliacao(googleLinkAvaliacaoSalvo);
                    setGoogleAvaliacaoPendingStatus(null);
                    setGoogleAvaliacaoModalOpen(false);
                  }}
                  className="rounded-xl"
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveGoogleAvaliacao} disabled={isSavingGoogleAvaliacao} className="rounded-xl">
                  {isSavingGoogleAvaliacao ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={fontesModalOpen} onOpenChange={setFontesModalOpen}>
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Fonte de Dados</DialogTitle>
                <DialogDescription>Configure de onde os dados são coletados (HTML ou API)</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                  <div className="text-xs text-muted-foreground">Tipo</div>
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant={tipo === 'HTML' ? 'secondary' : 'outline'}
                      onClick={() => setTipo('HTML')}
                      className="rounded-xl"
                    >
                      HTML
                    </Button>
                    <Button
                      type="button"
                      variant={tipo === 'API' ? 'secondary' : 'outline'}
                      onClick={() => setTipo('API')}
                      className="rounded-xl"
                    >
                      API
                    </Button>
                    <Button
                      type="button"
                      variant={tipo === 'XML' ? 'secondary' : 'outline'}
                      onClick={() => setTipo('XML')}
                      className="rounded-xl"
                    >
                      XML
                    </Button>
                    <Button
                      type="button"
                      variant={tipo === 'INTERNO' ? 'secondary' : 'outline'}
                      onClick={() => setTipo('INTERNO')}
                      className="rounded-xl"
                    >
                      Interno
                    </Button>
                  </div>
                </div>

                {tipo !== 'INTERNO' &&
                  (tipo === 'XML' ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Link da URL</Label>
                      <Input
                        placeholder="https://"
                        value={links}
                        onChange={(e) => setLinks(e.target.value)}
                        className="bg-background border-border rounded-2xl"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Links</Label>
                      <Textarea
                        placeholder="Insira um ou mais links, um por linha"
                        value={links}
                        onChange={(e) => setLinks(e.target.value)}
                        className="bg-background border-border rounded-2xl"
                        rows={6}
                      />
                    </div>
                  ))}

                {tipo === 'API' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Body</Label>
                    <Textarea
                      placeholder="Opcional"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="bg-background border-border rounded-2xl"
                      rows={6}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setFontesModalOpen(false)} disabled={isSubmittingFontes}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveFonteDados} disabled={isSubmittingFontes || !tipo}>
                    {isSubmittingFontes ? 'Salvando...' : fonteId ? 'Salvar alterações' : 'Salvar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader>
                <DialogTitle>Alterar senha</DialogTitle>
                <DialogDescription>Defina uma nova senha para sua conta.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setChangePasswordOpen(false);
                    setShowNewPassword(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button onClick={handleChangePassword} disabled={isSavingPassword}>
                  {isSavingPassword ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
            <DialogContent className="sm:max-w-[900px]">
              <DialogHeader>
                <DialogTitle>Termos de uso</DialogTitle>
                <DialogDescription>Visualize os termos de uso da Worklivoo.</DialogDescription>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: termosHtml }}
                />
              </div>
            </DialogContent>
          </Dialog>

          <Dialog
            open={!isTipoOutros && isEditingMensagemSaudacao}
            onOpenChange={(open) => {
              if (isTipoOutros) return;
              setIsEditingMensagemSaudacao(open);
            }}
          >
            <DialogContent className="sm:max-w-[1100px] max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Selecionar modelo de saudação</DialogTitle>
                <DialogDescription>Escolha um dos modelos para salvar.</DialogDescription>
              </DialogHeader>
              <div className={`grid gap-3 py-2 ${saudacaoModelos.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {saudacaoModelos.map((m) => {
                  const selected = idMensagemSaudacaoApiOficialSalvo === m.id;
                  return (
                    <Button
                      key={m.id}
                      type="button"
                      variant="outline"
                      onClick={() => handleSelectMensagemSaudacaoModelo({ id: m.id, texto: m.texto })}
                      disabled={isSavingMensagemSaudacao}
                      className={`h-auto w-full justify-start rounded-xl p-4 text-left ${selected ? 'border-primary' : ''}`}
                    >
                      <div className="w-full min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-medium">{m.titulo}</div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">
                          {renderSaudacaoTexto(m.texto)}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out pt-6">
            {isAdmin && (
              <TabsContent value="gerais" className="mt-0">
              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="border-border bg-card shadow-sm lg:col-span-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <SettingsIcon className="h-4 w-4 text-muted-foreground" />
                        Conta
                      </CardTitle>
                      {user.cliente_status ? <Badge variant="outline">{user.cliente_status}</Badge> : <Badge variant="outline">-</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">Informações do seu usuário</div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Nome do usuário</div>
                          <div className="mt-1 text-lg font-semibold leading-tight truncate">{user.nome}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">E-mail do usuário</div>
                          <div className="mt-1 text-sm font-medium truncate">{user.email}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">ID do usuário</div>
                          <div className="mt-1 text-[11px] font-mono text-muted-foreground/70 break-all select-text">
                            {user.id}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Crown className="h-4 w-4" />
                        Plano do usuário
                      </div>
                      <div className="mt-3 rounded-xl border border-border/60 bg-background/60 px-3 py-2">
                        <div className="mt-1 text-sm font-medium truncate">
                          {(() => {
                            const planName = (user.planoNome || '').trim();
                            const leads =
                              user.planoQuantidadeLeads !== null && user.planoQuantidadeLeads !== undefined
                                ? String(user.planoQuantidadeLeads)
                                : (user.plano || '').trim();
                            if (!planName && !leads) return '-';
                            if (!planName) return `${leads} Leads/mês`;
                            if (!leads) return planName;
                            return `${planName} - ${leads} Leads/mês`;
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setChangePasswordOpen(true)}>
                        <KeyRound className="h-4 w-4" />
                        Alterar senha
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start gap-2 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setTermsOpen(true)}>
                        <FileText className="h-4 w-4" />
                        Visualizar termos
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="lg:col-span-2 grid gap-5">
                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <Shuffle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Distribuição de Leads</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">Defina como os leads serão direcionados para qualificação</div>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => setReceiveMethodModalOpen(true)} className="rounded-xl">
                          Editar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {telefoneQualificado ? (
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                          <div className="text-xs text-muted-foreground">Configuração atual</div>
                          <div className="mt-2 text-sm font-medium text-foreground">{modoQualificacao || 'Whatsapp'}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(() => {
                              const modo = String(modoQualificacao || '').toLowerCase();
                              if (modo === 'roleta' || modo === 'whatsapp') {
                                return (telefoneQualificado || '')
                                  .split(',')
                                  .map((n) => n.trim())
                                  .filter(Boolean)
                                  .map((n) => (
                                    <Badge key={n} variant="outline" className="font-normal bg-background/60">
                                      {formatPhone(n)}
                                    </Badge>
                                  ));
                              }
                              return (
                                <Badge variant="outline" className="font-normal bg-background/60">
                                  {formatPhone(telefoneQualificado)}
                                </Badge>
                              );
                            })()}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 text-sm text-muted-foreground">
                          Nenhuma configuração salva.
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <WhatsAppLogo size={16} className="text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Leads WhatsApp</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">Ativa o atendimento automático para mensagens recebidas no WhatsApp. Ao ativar essa funcionalidade, a IA irá realizar o atendimento com todos leads que chamarem diretamente no WhatsApp.</div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">Status</div>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="outline" className="font-normal bg-background/60">
                                {leadsWhatsappStatus === 'Ativado' ? 'Ativado' : 'Desativado'}
                              </Badge>
                            </div>
                          </div>

                          <Switch
                            checked={leadsWhatsappStatus === 'Ativado'}
                            onCheckedChange={async (checked) => {
                              if (!user) return;
                              const userIdForWhatsapp = user.isMembro ? user.user_id_empresa : user.id;
                              if (!userIdForWhatsapp) return;
                              setIsSavingLeadsWhatsapp(true);
                              const newStatus = checked ? 'Ativado' : 'Desativado';
                              const { error } = await updateLeadsWhatsappStatus(userIdForWhatsapp, newStatus);
                              setIsSavingLeadsWhatsapp(false);
                              if (error) {
                                toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar o status do WhatsApp.' });
                                return;
                              }
                              setLeadsWhatsappStatus(newStatus);
                              toast({ title: 'Status atualizado', description: `Atendimento via WhatsApp ${checked ? 'ativado' : 'desativado'}.` });
                            }}
                            disabled={isSavingLeadsWhatsapp}
                            className="data-[state=checked]:bg-[#EBF57D]"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <MessageCircle className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Mensagem de Saudação</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">Mensagem usada para iniciar conversa com um novo lead.</div>
                          </div>
                        </div>

                        {!isTipoOutros && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsEditingMensagemSaudacao(true)}
                            disabled={isSavingMensagemSaudacao}
                            className="rounded-xl"
                          >
                            Editar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-muted-foreground">Modelo selecionado</div>
                          <Badge variant="outline" className="font-normal bg-background/60">
                            {isTipoOutros
                              ? '-'
                              : idMensagemSaudacaoApiOficialSalvo
                                ? saudacaoModelos.find((m) => m.id === idMensagemSaudacaoApiOficialSalvo)?.titulo || idMensagemSaudacaoApiOficialSalvo
                                : '-'}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm text-foreground whitespace-pre-wrap">
                          {mensagemSaudacaoPortalSalva ? renderSaudacaoTexto(mensagemSaudacaoPortalSalva) : '-'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Fluxo de FollowUp</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Configure a frequencia e a quantidade de tentativas que a IA fara para retomar o contato com o lead sempre que ele ficar sem resposta por um determinado periodo.
                            </div>
                          </div>
                        </div>
                        {(frequenciaFollowupSalva.trim().length > 0 || quantidadeMaximaFollowupSalva.trim().length > 0) && !isEditingFrequenciaFollowup && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsEditingFrequenciaFollowup(true)}
                            className="rounded-xl"
                          >
                            Editar
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loadingFrequenciaFollowup ? (
                        <div className="text-sm text-muted-foreground">Carregando...</div>
                      ) : (frequenciaFollowupSalva.trim().length > 0 || quantidadeMaximaFollowupSalva.trim().length > 0) && !isEditingFrequenciaFollowup ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                            <div className="text-xs text-muted-foreground">Frequência atual</div>
                            <div className="mt-2">
                              <Badge variant="outline" className="font-normal bg-background/60">
                                {frequenciaFollowupSalva ? `${frequenciaFollowupSalva}h` : '-'}
                              </Badge>
                            </div>
                          </div>
                          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                            <div className="text-xs text-muted-foreground">Quantidade de FollowUp</div>
                            <div className="mt-2">
                              <Badge variant="outline" className="font-normal bg-background/60">
                                {quantidadeMaximaFollowupSalva ? `${quantidadeMaximaFollowupSalva}x` : '-'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Frequência ({user.api_oficial ? 1 : 6} a {user.api_oficial ? 8 : 36} horas)</div>
                              <Input
                                type="number"
                                min={user.api_oficial ? 1 : 6}
                                max={user.api_oficial ? 8 : 36}
                                step={1}
                                value={frequenciaFollowup}
                                onChange={(e) => setFrequenciaFollowup(e.target.value)}
                                className="bg-background border-border rounded-2xl"
                                placeholder={user.api_oficial ? 'Ex: 1' : 'Ex: 12'}
                              />
                            </div>
                            <div className="space-y-2">
                              <div className="text-xs text-muted-foreground">Quantidade de FollowUp (1 a 3)</div>
                              <Input
                                type="number"
                                min={1}
                                max={3}
                                step={1}
                                value={quantidadeMaximaFollowup}
                                onChange={(e) => setQuantidadeMaximaFollowup(e.target.value)}
                                className="bg-background border-border rounded-2xl"
                                placeholder="Ex: 2"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            {(frequenciaFollowupSalva.trim().length > 0 || quantidadeMaximaFollowupSalva.trim().length > 0) && (
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setFrequenciaFollowup(frequenciaFollowupSalva);
                                  setQuantidadeMaximaFollowup(quantidadeMaximaFollowupSalva);
                                  setIsEditingFrequenciaFollowup(false);
                                }}
                                className="rounded-xl"
                              >
                                Cancelar
                              </Button>
                            )}
                            <Button onClick={handleSaveFrequenciaFollowup} disabled={isSavingFrequenciaFollowup} className="rounded-xl">
                              {isSavingFrequenciaFollowup ? 'Salvando...' : 'Salvar'}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                          <History className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">Transbordo de FollowUp</CardTitle>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Quando ativado, apos a IA realizar todas as tentativas de FollowUp, a equipe sera notificada para ficar ciente de que o cliente nao deu continuidade no atendimento.
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Status do transbordo</div>
                              <div className="mt-1 flex items-center gap-2">
                                <Badge variant="outline" className="font-normal bg-background/60">
                                  {loadingTransbordoStatus ? 'Carregando...' : transbordoAtivado ? 'Ativado' : 'Desativado'}
                                </Badge>
                              </div>
                            </div>

                            <Switch
                              checked={transbordoAtivado}
                              onCheckedChange={handleToggleTransbordoStatus}
                              disabled={loadingTransbordoStatus || isSavingTransbordoStatus}
                              className="data-[state=checked]:bg-[#EBF57D]"
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Etapas do Lead</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {loadingTransbordoEtapas ? (
                                  <Badge variant="outline" className="font-normal bg-background/60">
                                    Carregando...
                                  </Badge>
                                ) : transbordoEtapasSelecionadas.length > 0 ? (
                                  transbordoEtapasSelecionadas.map((etapa) => (
                                    <Badge key={etapa} variant="outline" className="font-normal bg-background/60">
                                      {etapa}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge variant="outline" className="font-normal bg-background/60">
                                    Nenhuma etapa selecionada
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setTransbordoEtapasOpen(true)}
                              disabled={loadingTransbordoEtapas}
                              className="rounded-xl"
                            >
                              Editar
                            </Button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:col-span-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs text-muted-foreground">Metodo de aviso</div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Badge variant="outline" className="font-normal bg-background/60">
                                  {loadingTransbordoMetodoConfig ? 'Carregando...' : transbordoMetodoAviso === 'whatsapp' ? 'WhatsApp' : 'Roleta'}
                                </Badge>
                                {transbordoTelefones.length > 0 ? (
                                  transbordoTelefones.map((phone) => (
                                    <Badge key={phone} variant="outline" className="font-normal bg-background/60">
                                      {phone}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge variant="outline" className="font-normal bg-background/60">
                                    Nenhum numero cadastrado
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setTransbordoMetodoAvisoOpen(true)}
                              disabled={loadingTransbordoMetodoConfig}
                              className="rounded-xl"
                            >
                              Editar
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>


                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <Star className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Google Avaliação</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">
                              Ative para permitir que a IA envie o link de avaliação do Google quando o lead for qualificado.
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setGoogleLinkAvaliacao(googleLinkAvaliacaoSalvo);
                            setGoogleAvaliacaoPendingStatus(null);
                            setGoogleAvaliacaoModalOpen(true);
                          }}
                          className="rounded-xl"
                        >
                          Editar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loadingGoogleAvaliacao ? (
                        <div className="text-sm text-muted-foreground">Carregando...</div>
                      ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-xs text-muted-foreground">Status</div>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="outline" className="font-normal bg-background/60">
                                    {googleAvaliacaoAtiva ? 'Ativado' : 'Desativado'}
                                  </Badge>
                                </div>
                              </div>

                              <Switch
                                checked={googleAvaliacaoAtiva}
                                onCheckedChange={handleToggleGoogleAvaliacao}
                                disabled={isSavingGoogleAvaliacao}
                                className="data-[state=checked]:bg-[#EBF57D]"
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4">
                            <div className="text-xs text-muted-foreground">Link do Google Avaliação</div>
                            <div className="mt-2 text-sm text-foreground break-all">
                              {googleLinkAvaliacaoSalvo || '-'}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                            <Database className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-semibold">Fonte de Dados</CardTitle>
                            <div className="mt-1 text-xs text-muted-foreground">Configure de onde os dados são coletados (HTML ou API)</div>
                          </div>
                        </div>
                        <Button variant="secondary" size="sm" onClick={openFontesModal} className="rounded-xl">
                          Editar
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {loadingFontes ? (
                        <div className="text-sm text-muted-foreground">Carregando...</div>
                      ) : fontes.length > 0 ? (
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 w-full overflow-hidden">
                          <div className="text-xs text-muted-foreground">Fonte atual</div>
                          <div className="mt-2 grid gap-3 w-full max-w-full">
                            <div>
                              <div className="text-xs text-muted-foreground">Tipo</div>
                              <div className="mt-1 text-sm font-medium text-foreground">{fontes[0]?.tipo || '-'}</div>
                            </div>
                            <div className="w-full max-w-full overflow-hidden">
                              <div className="text-xs text-muted-foreground">Links</div>
                              <div className="mt-1 text-xs text-foreground whitespace-pre-wrap break-all break-words overflow-wrap-anywhere w-full max-w-full">{fontes[0]?.link || '-'}</div>
                            </div>
                            {fontes[0]?.body && (
                              <div className="w-full max-w-full overflow-hidden">
                                <div className="text-xs text-muted-foreground">Body</div>
                                <div className="mt-1 text-xs text-foreground whitespace-pre-wrap break-all break-words overflow-wrap-anywhere w-full max-w-full">{fontes[0]?.body}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 text-sm text-muted-foreground">
                          Nenhuma fonte cadastrada ainda.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="whatsapp" className="mt-0">
                <WhatsApp />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="membros" className="mt-0">
                <Membros />
              </TabsContent>
            )}

            <TabsContent value="base-de-conhecimento" className="mt-0">
              <BaseDeConhecimento />
            </TabsContent>

            <TabsContent value="estoque-de-produtos" className="mt-0">
              <EstoqueDeProdutosTab />
            </TabsContent>

            <TabsContent value="historico-de-otimizacoes" className="mt-0">
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold">Histórico de Otimizações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingFeedbacks ? (
                    <div className="text-muted-foreground">Carregando...</div>
                  ) : feedbacks.length === 0 ? (
                    <div className="text-muted-foreground">Nenhum registro encontrado.</div>
                  ) : (
                    <TooltipProvider delayDuration={150}>
                      <div className="rounded-xl border border-border/50 shadow-sm overflow-hidden">
                        <Table className="w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Feedback</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {feedbacks.map((f) => (
                              <TableRow key={String(f.feedback_id || `${f.user_id}-${f.mensagem_id}-${f.criado_em}`)}>
                                <TableCell>{f.criado_em ? new Date(f.criado_em).toLocaleString('pt-BR') : '-'}</TableCell>
                                <TableCell className="max-w-md truncate" title={f.comentario_mensagem}>
                                  {f.comentario_mensagem || '-'}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const done = f.status === true;
                                    if (done) {
                                      return (
                                        <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
                                          Otimização Concluida
                                        </Badge>
                                      );
                                    }
                                    return (
                                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                        Em Andamento
                                      </Badge>
                                    );
                                  })()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TooltipProvider>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="assinatura" className="mt-0">
                <Assinatura />
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
