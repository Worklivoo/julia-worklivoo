import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import {
  addFonteDados,
  getFontesDadosByUser,
  updateFonteDados,
  getTelefoneQualificadoByUser,
  updateTelefoneQualificadoByUser,
  getLeadsWhatsappStatus,
  updateLeadsWhatsappStatus,
  getMensagemSaudacaoConfigByUser,
  updateMensagemSaudacaoConfigByUser,
  getFollowupConfigByUser,
  updateFollowupConfigByUser,
  getTransbordoFollowupStatusByUser,
  updateTransbordoFollowupStatusByUser,
  getTransbordoFollowupEtapasByUser,
  updateTransbordoFollowupEtapasByUser,
  getTransbordoFollowupMetodoConfigByUser,
  updateTransbordoFollowupMetodoConfigByUser,
  getGoogleAvaliacaoConfigByUser,
  updateGoogleAvaliacaoConfigByUser,
} from '@/lib/supabase-utils';
import { formatPhoneInput, normalizePhoneForStorage, parseStoredPhones } from './phones';
import { getSaudacaoModelos } from './saudacao';
import { transbordoEtapasOptions } from './constants';

interface Params {
  user: any;
  settingsOwnerUserId: string;
}

/**
 * Estado, carregamento e gravação de tudo que a aba Gerais mexe: distribuição de leads, WhatsApp,
 * saudação, fluxo e transbordo de follow up, Google Avaliação, fonte de dados e senha.
 */
export const useGerais = ({ user, settingsOwnerUserId }: Params) => {
  const { toast } = useToast();
  const saudacaoModelos = getSaudacaoModelos(user?.tipo);
  const isTipoOutros = String(user?.tipo || '').trim().toLowerCase() === 'outros';

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

  const handleToggleLeadsWhatsapp = async (checked: boolean) => {
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
  };

  return {
    tipo,
    setTipo,
    links,
    setLinks,
    body,
    setBody,
    cliente,
    setCliente,
    isSubmittingFontes,
    setIsSubmittingFontes,
    fontes,
    setFontes,
    loadingFontes,
    setLoadingFontes,
    fontesModalOpen,
    setFontesModalOpen,
    fonteId,
    setFonteId,
    telefoneQualificado,
    setTelefoneQualificado,
    leadsWhatsappStatus,
    setLeadsWhatsappStatus,
    isSavingLeadsWhatsapp,
    setIsSavingLeadsWhatsapp,
    receiveMethod,
    setReceiveMethod,
    transbordoAtivado,
    setTransbordoAtivado,
    transbordoMetodoAviso,
    setTransbordoMetodoAviso,
    loadingTransbordoStatus,
    setLoadingTransbordoStatus,
    isSavingTransbordoStatus,
    setIsSavingTransbordoStatus,
    transbordoEtapasOpen,
    setTransbordoEtapasOpen,
    transbordoEtapasSelecionadas,
    setTransbordoEtapasSelecionadas,
    transbordoEtapasDraft,
    setTransbordoEtapasDraft,
    loadingTransbordoEtapas,
    setLoadingTransbordoEtapas,
    isSavingTransbordoEtapas,
    setIsSavingTransbordoEtapas,
    transbordoMetodoAvisoOpen,
    setTransbordoMetodoAvisoOpen,
    transbordoMetodoAvisoDraft,
    setTransbordoMetodoAvisoDraft,
    transbordoTelefones,
    setTransbordoTelefones,
    transbordoTelefonesDraft,
    setTransbordoTelefonesDraft,
    loadingTransbordoMetodoConfig,
    setLoadingTransbordoMetodoConfig,
    isSavingTransbordoMetodoConfig,
    setIsSavingTransbordoMetodoConfig,
    googleAvaliacaoAtiva,
    setGoogleAvaliacaoAtiva,
    googleLinkAvaliacao,
    setGoogleLinkAvaliacao,
    googleLinkAvaliacaoSalvo,
    setGoogleLinkAvaliacaoSalvo,
    loadingGoogleAvaliacao,
    setLoadingGoogleAvaliacao,
    isSavingGoogleAvaliacao,
    setIsSavingGoogleAvaliacao,
    googleAvaliacaoModalOpen,
    setGoogleAvaliacaoModalOpen,
    googleAvaliacaoPendingStatus,
    setGoogleAvaliacaoPendingStatus,
    whatsappPhones,
    setWhatsappPhones,
    roletaPhones,
    setRoletaPhones,
    isSavingReceiveMethod,
    setIsSavingReceiveMethod,
    receiveMethodModalOpen,
    setReceiveMethodModalOpen,
    modoQualificacao,
    setModoQualificacao,
    changePasswordOpen,
    setChangePasswordOpen,
    termsOpen,
    setTermsOpen,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isSavingPassword,
    setIsSavingPassword,
    showNewPassword,
    setShowNewPassword,
    mensagemSaudacaoPortal,
    setMensagemSaudacaoPortal,
    mensagemSaudacaoPortalSalva,
    setMensagemSaudacaoPortalSalva,
    idMensagemSaudacaoApiOficial,
    setIdMensagemSaudacaoApiOficial,
    idMensagemSaudacaoApiOficialSalvo,
    setIdMensagemSaudacaoApiOficialSalvo,
    isSavingMensagemSaudacao,
    setIsSavingMensagemSaudacao,
    isEditingMensagemSaudacao,
    setIsEditingMensagemSaudacao,
    frequenciaFollowup,
    setFrequenciaFollowup,
    frequenciaFollowupSalva,
    setFrequenciaFollowupSalva,
    quantidadeMaximaFollowup,
    setQuantidadeMaximaFollowup,
    quantidadeMaximaFollowupSalva,
    setQuantidadeMaximaFollowupSalva,
    loadingFrequenciaFollowup,
    setLoadingFrequenciaFollowup,
    isSavingFrequenciaFollowup,
    setIsSavingFrequenciaFollowup,
    isEditingFrequenciaFollowup,
    setIsEditingFrequenciaFollowup,
    getQualificacaoPhonesByMetodo,
    getTransbordoPhonesForMethod,
    handleSaveReceiveMethod,
    openFontesModal,
    handleSaveFonteDados,
    handleChangePassword,
    handleSelectMensagemSaudacaoModelo,
    handleSaveFrequenciaFollowup,
    handleToggleTransbordoStatus,
    handleSaveTransbordoEtapas,
    handleSaveTransbordoMetodoConfig,
    isValidGoogleAvaliacaoLink,
    handleToggleGoogleAvaliacao,
    handleSaveGoogleAvaliacao,
    triggerFontesWebhook,
    handleToggleLeadsWhatsapp,
    isTipoOutros,
    saudacaoModelos,
  };
};

export type GeraisCtx = ReturnType<typeof useGerais>;
