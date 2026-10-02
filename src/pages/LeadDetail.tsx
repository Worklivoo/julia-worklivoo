import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConversationThread, parseLeadsV2Conversa, parseTimestampzToDate } from '@/components/ConversationThread';
import { useCRM } from '@/contexts/CRMContext';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { useToast } from '@/hooks/use-toast';
import { getMembrosByUser } from '@/lib/membros';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase-utils';
import { Membro } from '@/types';
import { ArrowLeft, Check, X, UserPlus, Handshake, MessageCircle, PhoneCall, CheckCircle, Star, CircleDollarSign, StickyNote, ChevronDown, ChevronUp, Pin, PinOff, Pencil, Trash2, Plus, ListTodo, Clock, AlertTriangle, CalendarDays } from 'lucide-react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useLeadNotas } from '@/hooks/use-lead-notas';
import { useLeadTarefas, getTarefaStatus, LeadTarefa } from '@/hooks/use-lead-tarefas';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';

type StageDef = { id: string; name: string; icon: React.ComponentType<{ className?: string }> };

// Botão de ícone com dica (editar, excluir, fixar...).
const IconAction = ({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className={`wl-iconbtn ${danger ? 'wl-iconbtn--danger' : ''}`}
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent className="wl-scope wl-tip">{label}</TooltipContent>
  </Tooltip>
);

// Barra de etapas: concluídas em preto, atual com aro preto, futuras em cinza.
const StageStepper = ({
  stages,
  currentStageIndex,
  onStageClick,
}: {
  stages: StageDef[];
  currentStageIndex: number;
  onStageClick: (stageId: string) => void;
}) => (
  <div className="wl-stepper">
    {stages.map((stage, idx) => {
      const Icon = stage.icon;
      const isCurrent = idx === currentStageIndex;
      const isDone = idx < currentStageIndex;
      return (
        <React.Fragment key={stage.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`wl-stepper__dot ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                aria-label={stage.name}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStageClick(stage.id)}
              >
                {isDone ? <Check aria-hidden="true" /> : <Icon aria-hidden="true" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="wl-scope wl-tip">{stage.name}</TooltipContent>
          </Tooltip>
          {idx < stages.length - 1 && <span className={`wl-stepper__line ${isDone ? 'is-done' : ''}`} />}
        </React.Fragment>
      );
    })}
  </div>
);

const TAREFA_TAGS = {
  concluida: { text: 'Concluída', cls: 'wl-tag--won', Icon: CheckCircle },
  atrasada: { text: 'Atrasada', cls: 'wl-tag--alert', Icon: AlertTriangle },
  pendente: { text: 'Pendente', cls: 'wl-tag--plain', Icon: Clock },
  sem_prazo: { text: 'Sem prazo', cls: 'wl-tag--idle', Icon: CalendarDays },
} as const;


const normalizeCurrencyDigits = (value: string) => value.replace(/\D/g, '').slice(0, 12);

const formatCurrencyValue = (value: string) => {
  const digits = normalizeCurrencyDigits(value);
  if (!digits) return '';

  const padded = digits.padStart(3, '0');
  const cents = padded.slice(-2);
  const integerDigits = padded.slice(0, -2);
  const integer = Number(integerDigits).toLocaleString('pt-BR');

  return `${integer},${cents}`;
};

const parseCurrencyToNumber = (value: string) => {
  const digits = normalizeCurrencyDigits(value);
  if (!digits) return 0;
  return Number(digits) / 100;
};

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, updateLead, user, loadingLeads, hasLoadedLeads } = useCRM();
  const { origins } = useLeadOrigins();
  const [isEditingNegotiation, setIsEditingNegotiation] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [membrosLoaded, setMembrosLoaded] = useState(false);
  const [isEditingIAAtiva, setIsEditingIAAtiva] = useState(false);
  const [iaAtivaValue, setIaAtivaValue] = useState<'Sim' | 'Não'>('Sim');
  const [isUpdatingIAAtiva, setIsUpdatingIAAtiva] = useState(false);
  const [isQualifyDialogOpen, setIsQualifyDialogOpen] = useState(false);
  const [isQualifyingLead, setIsQualifyingLead] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'conversa' | 'anotacoes' | 'tarefas'>('conversa');
  const [novaAnotacaoTexto, setNovaAnotacaoTexto] = useState('');
  const [novaAnotacaoFixada, setNovaAnotacaoFixada] = useState(false);
  const [isCriandoAnotacao, setIsCriandoAnotacao] = useState(false);
  const [editandoNotaId, setEditandoNotaId] = useState<string | null>(null);
  const [editandoNotaTexto, setEditandoNotaTexto] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isNovaAnotacaoDialogOpen, setIsNovaAnotacaoDialogOpen] = useState(false);
  const [notaExpandidaMap, setNotaExpandidaMap] = useState<Record<string, boolean>>({});
  const [isNovaTarefaDialogOpen, setIsNovaTarefaDialogOpen] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState({
    tarefa_titulo: '',
    tarefa_descricao: '',
    data_vencimento: '',
  });
  const [isCriandoTarefa, setIsCriandoTarefa] = useState(false);
  const [editandoTarefaId, setEditandoTarefaId] = useState<string | null>(null);
  const [editandoTarefa, setEditandoTarefa] = useState<{
    tarefa_titulo: string;
    tarefa_descricao: string;
    data_vencimento: string;
  }>({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
  const [confirmDeleteTarefaId, setConfirmDeleteTarefaId] = useState<string | null>(null);
  const [tarefaExpandidaMap, setTarefaExpandidaMap] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const leadNotas = useLeadNotas({ leadId: id, user });
  const leadTarefas = useLeadTarefas({ leadId: id, user });

  const lead = leads.find(l => l.id === id);
  const [editedLead, setEditedLead] = useState(lead);

  const conversationMessages = useMemo(() => {
    const leadId = String(lead?.id || id || '');
    const raw = String((lead as any)?.conversa || '');
    return parseLeadsV2Conversa(leadId, raw, Date.now());
  }, [lead?.id, (lead as any)?.conversa, id]);

  const createdAtLabel = useMemo(() => {
    const raw = (lead as any)?.created_at ?? (lead as any)?.createdAt ?? null;
    const d =
      raw instanceof Date
        ? raw
        : parseTimestampzToDate(typeof raw === 'string' ? raw : null);
    if (!d || Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }, [lead]);

  // Helper para normalizar o valor de ativo_ia
  const normalizeAtivoIA = (value: string | null | undefined): 'Sim' | 'Não' => {
    if (!value) return 'Sim'; // Padrão é Sim se for null/undefined
    const normalized = value.toString().toUpperCase().trim();
    // Verifica todas as variações de NÃO
    if (['NÃO', 'NAO', 'NO', 'FALSE', '0', 'N', 'NAO'].includes(normalized)) {
      return 'Não';
    }
    return 'Sim';
  };

  useEffect(() => {
    if (lead) {
      setEditedLead(lead);
    }
  }, [lead]);

  useEffect(() => {
    if (!lead) return;
    setIaAtivaValue(normalizeAtivoIA(lead.ativo_ia));
  }, [lead]);

  // Carregar membros (para visualização e seleção)
  useEffect(() => {
    const loadMembros = async () => {
      if (user) {
        setMembrosLoaded(false);
        try {
          // Se for membro, busca os membros da empresa do dono (user_id_empresa)
          // Se for admin, busca seus próprios membros (id)
          const targetUserId = user.isMembro ? user.user_id_empresa : user.id;
          
          if (targetUserId) {
            const { data } = await getMembrosByUser(targetUserId);
            if (data) {
              setMembros(data);
            }
          }
        } catch (error) {
          console.error('Erro ao carregar membros:', error);
        } finally {
          setMembrosLoaded(true);
        }
      }
    };
    loadMembros();
  }, [user]);

  const responsibleLabel = useMemo(() => {
    const membroId = (lead as any)?.membro_id as string | null | undefined;
    if (!membroId || !String(membroId).trim()) return 'Sem Responsável';
    if (!membrosLoaded) return 'Carregando...';
    const found = membros.find((m) => String(m.membro_id) === String(membroId));
    return found?.membro_nome || 'Sem Responsável';
  }, [lead, membros, membrosLoaded]);

  const canEditResponsible = useMemo(() => {
    if (!user) return false;
    if (!user.isMembro) return true;
    const currentMember = membros.find((m) => String(m.membro_email || '').toLowerCase() === String(user.email || '').toLowerCase());
    return currentMember?.membro_tipo === 'Administrador';
  }, [user, membros]);

  if (!lead) {
    if (!hasLoadedLeads || loadingLeads) {
      return (
        <div className="wl-scope wl-page wl-page--board">
          <div className="wl-empty">
            <p className="wl-empty__title">Carregando...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="wl-scope wl-page wl-page--board">
        <div className="wl-empty">
          <p className="wl-empty__title">Lead não encontrado</p>
          <p className="wl-empty__text">Ele pode ter sido removido ou você não tem acesso.</p>
          <button type="button" className="wl-btn wl-btn--lime" onClick={() => navigate('/leads')}>
            Voltar ao funil
          </button>
        </div>
      </div>
    );
  }

  const stages = [
    { id: 'entrada', name: 'Entrada do Lead', icon: UserPlus },
    { id: 'tentando-contato', name: 'Tentando Contato', icon: PhoneCall },
    { id: 'contato-realizado', name: 'Contato Realizado', icon: MessageCircle },
    { id: 'qualificada', name: 'Oportunidade Qualificada', icon: Handshake },
    { id: 'orcamento-negociacao', name: 'Orçamento/Negociação', icon: Handshake },
    { id: 'venda', name: 'Venda', icon: CircleDollarSign },
  ];

  const currentStageIndex = stages.findIndex(stage => stage.id === lead.stage);

  const handleMarkAsWon = () => {
    updateLead(id!, { status: 'won', stage: 'venda' });
  };

  const handleMarkAsLost = () => {
    updateLead(id!, { status: 'lost' });
  };

  const handleStageChange = (newStage: string) => {
    updateLead(id!, { stage: newStage as any });
  };

  const handleSaveNegotiation = () => {
    if (editedLead) {
      const updates: Record<string, unknown> = {
        opportunityName: editedLead.opportunityName,
        source: editedLead.source,
        value: Number(editedLead.value) || 0,
      };
      if (canEditResponsible) {
        updates.membro_id = editedLead.membro_id ? editedLead.membro_id : null;
      }
      updateLead(id!, updates as any);
      setIsEditingNegotiation(false);
    }
  };

  const handleSaveContact = () => {
    if (editedLead) {
      updateLead(id!, {
        leadName: editedLead.leadName,
        email: editedLead.email,
        phone: editedLead.phone,
        expectedCloseDate: editedLead.expectedCloseDate,
      });
      setIsEditingContact(false);
    }
  };

  const handleResumeNegotiation = () => {
    updateLead(id!, { status: 'active' });
  };

  const handleOpenWhatsApp = () => {
    const phoneDigits = String(lead.phone || '').replace(/\D/g, '');
    if (!phoneDigits) return;
    window.open(`https://wa.me/${phoneDigits}`, '_blank', 'noopener,noreferrer');
  };

  const handleQualifyLead = async () => {
    if (!id || !user) return;

    const ownerUserId = user.isMembro ? user.user_id_empresa : user.id;
    if (!ownerUserId) {
      toast({
        title: 'Usuário não identificado',
        description: 'Não foi possível localizar o usuário responsável para enviar a qualificação.',
      });
      return;
    }

    setIsQualifyingLead(true);

    try {
      const profile = await getUserProfile(String(ownerUserId));
      if (!profile) {
        toast({
          title: 'Perfil não encontrado',
          description: 'Não foi possível localizar o perfil em usuarios_v2.',
        });
        return;
      }

      const leadId = Number(id);
      const { data: leadRow, error: leadError } = await supabase
        .from('leads_v2')
        .select('lead_id, lead_telefone, lead_nome_pessoa, conversa, membro_id')
        .eq('lead_id', leadId)
        .maybeSingle();

      if (leadError || !leadRow) {
        toast({
          title: 'Lead não encontrado',
          description: 'Não foi possível localizar os dados atualizados do lead para qualificação.',
        });
        return;
      }

      const payload = {
        dados_entrada: {
          'user_id (Supabase)': String(profile.user_id ?? ownerUserId),
          'Token (Uazapi)': String(profile.token_instancia_uazapi ?? ''),
          modo_qualificacao: String(profile.modo_qualificacao ?? ''),
          telefone_qualificado: String(profile.telefone_qualificado ?? ''),
          id_api_whatsapp: String(profile.id_api_whatsapp ?? ''),
          api_oficial: Boolean(profile.api_oficial),
          lead_id: Number(leadRow.lead_id ?? leadId),
          membro_id: leadRow.membro_id ?? null,
          lead_telefone: String(leadRow.lead_telefone ?? lead.phone ?? ''),
          lead_nome_pessoa: String(leadRow.lead_nome_pessoa ?? lead.leadName ?? ''),
        },
        ultimo_historico: String(leadRow.conversa ?? (lead as any)?.conversa ?? ''),
      };

      const webhookResponse = await fetch(
        'https://primary-production-d442.up.railway.app/webhook/19699f97-249e-4499-9ee7-5d0332343997',
        {
          method: 'POST',
          mode: 'cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text().catch(() => '');
        throw new Error(errorText || 'Não foi possível enviar os dados ao webhook.');
      }

      await Promise.resolve(
        updateLead(id, {
          stage: 'qualificada',
          etapa_fluxo_followup: 'FIM',
          ativo_fluxo_cadencia: 'NAO',
          ativo_followup: 'FALSE',
        }) as any
      );

      setIsQualifyDialogOpen(false);
      toast({
        title: 'Lead qualificado',
        description: 'O lead foi encaminhado para a fila de distribuição com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Falha ao qualificar',
        description: error?.message || 'Não foi possível concluir a qualificação do lead.',
      });
    } finally {
      setIsQualifyingLead(false);
    }
  };

  const handleSaveIAAtiva = async () => {
    if (!id) return;
    setIsUpdatingIAAtiva(true);
    try {
      await Promise.resolve(
        updateLead(id, {
          ativo_ia: iaAtivaValue,
          lead_notas: editedLead?.lead_notas || '',
        }) as any
      );
      setIsEditingIAAtiva(false);
    } finally {
      setIsUpdatingIAAtiva(false);
    }
  };

  // Formata o telefone para o padrão +55 99 99999-9999
  function formatPhone(phone: string) {
    if (!phone) return '';
    // Remove tudo que não for número
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 13) {
      // +55 99 99999-9999
      return `+${cleaned.slice(0,2)} ${cleaned.slice(2,4)} ${cleaned.slice(4,9)}-${cleaned.slice(9)}`;
    }
    return phone;
  }

  const statusLabel = lead.status === 'active' ? 'Aberto' : lead.status === 'won' ? 'Vendido' : 'Perdido';

  const formatDateTimeLabel = (value: unknown) => {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return '—';
    const normalized = raw
      .replace(' ', 'T')
      .replace(/\+00:00$/, 'Z')
      .replace(/\+00$/, 'Z')
      .replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const handleCreateNota = async () => {
    const texto = novaAnotacaoTexto.trim();
    if (!texto) {
      toast({ title: 'Conteúdo obrigatório', description: 'Digite o conteúdo da anotação antes de salvar.' });
      return;
    }
    setIsCriandoAnotacao(true);
    try {
      const ok = await leadNotas.createNota({
        anotacao_conteudo: texto,
        anotacao_fixada: novaAnotacaoFixada,
      });
      if (ok) {
        setNovaAnotacaoTexto('');
        setNovaAnotacaoFixada(false);
        setIsNovaAnotacaoDialogOpen(false);
      }
    } finally {
      setIsCriandoAnotacao(false);
    }
  };

  const handleStartEdit = (nota: { anotacao_id: string; anotacao_conteudo: string }) => {
    setEditandoNotaId(nota.anotacao_id);
    setEditandoNotaTexto(nota.anotacao_conteudo);
  };

  const handleCancelEdit = () => {
    setEditandoNotaId(null);
    setEditandoNotaTexto('');
  };

  const handleSaveEdit = async () => {
    if (!editandoNotaId) return;
    const texto = editandoNotaTexto.trim();
    if (!texto) {
      toast({ title: 'Conteúdo obrigatório', description: 'A anotação não pode ficar vazia.' });
      return;
    }
    const ok = await leadNotas.updateNota(editandoNotaId, { anotacao_conteudo: texto });
    if (ok) handleCancelEdit();
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    const ok = await leadNotas.deleteNota(confirmDeleteId);
    if (ok) setConfirmDeleteId(null);
  };

  const parseTimestamp = (value: unknown): Date => {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return new Date(0);
    const normalized = raw
      .replace(' ', 'T')
      .replace(/\+00:00$/, 'Z')
      .replace(/\+00$/, 'Z')
      .replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  };

  const formatDateTimeVencimento = (value: unknown) => {
    const d = parseTimestamp(value);
    if (!d.getTime()) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const isoToLocalInputValue = (isoOrNull: string | null | undefined): string => {
    if (!isoOrNull) return '';
    const d = parseTimestamp(isoOrNull);
    if (!d.getTime()) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const localInputValueToIso = (inputValue: string): string | null => {
    if (!inputValue) return null;
    const d = new Date(inputValue);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  };


  const handleCreateTarefa = async () => {
    const titulo = novaTarefa.tarefa_titulo.trim();
    if (!titulo) {
      toast({ title: 'Título obrigatório', description: 'Digite o título da tarefa antes de salvar.' });
      return;
    }
    setIsCriandoTarefa(true);
    try {
      const ok = await leadTarefas.createTarefa({
        tarefa_titulo: titulo,
        tarefa_descricao: novaTarefa.tarefa_descricao,
        data_vencimento: localInputValueToIso(novaTarefa.data_vencimento),
      });
      if (ok) {
        setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
        setIsNovaTarefaDialogOpen(false);
      }
    } finally {
      setIsCriandoTarefa(false);
    }
  };

  const handleStartEditTarefa = (tarefa: LeadTarefa) => {
    setEditandoTarefaId(tarefa.tarefa_id);
    setEditandoTarefa({
      tarefa_titulo: tarefa.tarefa_titulo,
      tarefa_descricao: tarefa.tarefa_descricao ?? '',
      data_vencimento: isoToLocalInputValue(tarefa.data_vencimento),
    });
  };

  const handleCancelEditTarefa = () => {
    setEditandoTarefaId(null);
    setEditandoTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
  };

  const handleSaveEditTarefa = async () => {
    if (!editandoTarefaId) return;
    const titulo = editandoTarefa.tarefa_titulo.trim();
    if (!titulo) {
      toast({ title: 'Título obrigatório', description: 'A tarefa não pode ficar sem título.' });
      return;
    }
    const ok = await leadTarefas.updateTarefa(editandoTarefaId, {
      tarefa_titulo: titulo,
      tarefa_descricao: editandoTarefa.tarefa_descricao,
      data_vencimento: localInputValueToIso(editandoTarefa.data_vencimento),
    });
    if (ok) handleCancelEditTarefa();
  };

  const handleConfirmDeleteTarefa = async () => {
    if (!confirmDeleteTarefaId) return;
    const ok = await leadTarefas.deleteTarefa(confirmDeleteTarefaId);
    if (ok) setConfirmDeleteTarefaId(null);
  };

  const displayName =
    lead.leadName && lead.leadName !== 'N/A' ? lead.leadName : (lead.phone || lead.opportunityName || 'Lead');
  const currentStageName = stages.find((s) => s.id === lead.stage)?.name || '—';
  const tarefasPendentes = leadTarefas.tarefas.filter((t) => {
    const s = getTarefaStatus(t);
    return s === 'pendente' || s === 'atrasada' || s === 'sem_prazo';
  }).length;

  const tabs: { id: 'conversa' | 'anotacoes' | 'tarefas'; label: string; icon: React.ComponentType; count: number }[] = [
    { id: 'conversa', label: 'Conversa', icon: MessageCircle, count: 0 },
    { id: 'anotacoes', label: 'Anotações', icon: StickyNote, count: leadNotas.loading ? 0 : leadNotas.notas.length },
    { id: 'tarefas', label: 'Tarefas', icon: ListTodo, count: leadTarefas.loading ? 0 : tarefasPendentes },
  ];

  return (
    <div className="wl-scope wl-page wl-page--board">
      <header className="wl-lp-head">
        <div className="wl-lp-head__who">
          <button type="button" className="wl-btn wl-btn--glass wl-btn--icon" aria-label="Voltar ao funil" onClick={() => navigate('/leads')}>
            <ArrowLeft aria-hidden="true" width={16} height={16} />
          </button>
          <div className="wl-min0">
            <p className="wl-eyebrow">Detalhes do lead</p>
            <h1 className="wl-lp-head__title">{displayName}</h1>
            <div className="wl-pills">
              <span
                className={`wl-pill ${lead.status === 'won' ? 'wl-pill--ink' : lead.status === 'lost' ? 'wl-pill--danger-soft' : ''}`}
              >
                {statusLabel}
              </span>
              <span className="wl-pill wl-pill--soft">{currentStageName}</span>
              {lead.source && <span className="wl-pill wl-pill--soft">{lead.source}</span>}
            </div>
          </div>
        </div>

        <div className="wl-lp-head__actions">
          {lead.status === 'active' && (
            <>
              <button type="button" className="wl-btn wl-btn--lime" onClick={handleMarkAsWon}>
                <Check aria-hidden="true" width={16} height={16} />
                Marcar como venda
              </button>
              <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleMarkAsLost}>
                <X aria-hidden="true" width={16} height={16} />
                Marcar como perda
              </button>
            </>
          )}
          {(lead.status === 'won' || lead.status === 'lost') && (
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleResumeNegotiation}>
              Retomar negociação
            </button>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wl-btn wl-btn--glass wl-btn--icon"
                aria-label="Abrir WhatsApp"
                onClick={handleOpenWhatsApp}
                disabled={!String(lead.phone || '').replace(/\D/g, '')}
              >
                <WhatsAppIcon sx={{ width: 18, height: 18, display: 'block' }} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="wl-scope wl-tip">Abrir WhatsApp</TooltipContent>
          </Tooltip>
          {['entrada', 'tentando-contato', 'contato-realizado'].includes(lead.stage) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="wl-btn wl-btn--glass wl-btn--icon"
                  aria-label="Qualificar lead"
                  onClick={() => setIsQualifyDialogOpen(true)}
                >
                  <Star aria-hidden="true" width={16} height={16} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="wl-scope wl-tip">Qualificar lead</TooltipContent>
            </Tooltip>
          )}
        </div>
      </header>

      <div className="wl-lp-grid">
        <aside className="wl-lp-side">
          <section className="wl-lp-card" aria-labelledby="lp-contato">
            <div className="wl-lp-card__head">
              <div>
                <h2 id="lp-contato" className="wl-lp-card__title">Contato</h2>
                <p className="wl-lp-card__sub">Dados do cliente</p>
              </div>
              <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" onClick={() => setIsEditingContact((v) => !v)}>
                {isEditingContact ? 'Fechar' : 'Editar'}
              </button>
            </div>

            <div className="wl-dl">
              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-nome">Nome do lead</label>
                {isEditingContact ? (
                  <input
                    id="lp-nome"
                    className="wl-input"
                    value={editedLead?.leadName || ''}
                    onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, leadName: e.target.value } : null))}
                  />
                ) : (
                  <span className="wl-dl__value">{lead.leadName}</span>
                )}
              </div>

              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-email">E-mail</label>
                {isEditingContact ? (
                  <input
                    id="lp-email"
                    type="email"
                    className="wl-input"
                    value={editedLead?.email || ''}
                    onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, email: e.target.value } : null))}
                  />
                ) : (
                  <span className="wl-dl__value">{lead.email || 'N/A'}</span>
                )}
              </div>

              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-telefone">Telefone</label>
                {isEditingContact ? (
                  <input
                    id="lp-telefone"
                    className="wl-input"
                    value={editedLead?.phone || ''}
                    onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
                  />
                ) : (
                  <span className="wl-dl__value wl-dl__value--num">{formatPhone(lead.phone)}</span>
                )}
              </div>

              {lead.company && String(lead.company).trim() && (
                <div className="wl-dl__item">
                  <span className="wl-label">Empresa</span>
                  <span className="wl-dl__value">{lead.company}</span>
                </div>
              )}

              {isEditingContact && (
                <div className="wl-lp-actions">
                  <button
                    type="button"
                    className="wl-btn wl-btn--glass wl-btn--sm"
                    onClick={() => {
                      setIsEditingContact(false);
                      setEditedLead(lead);
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="wl-btn wl-btn--glass-ink wl-btn--sm" onClick={handleSaveContact}>
                    Salvar
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="wl-lp-card" aria-labelledby="lp-negociacao">
            <div className="wl-lp-card__head">
              <div>
                <h2 id="lp-negociacao" className="wl-lp-card__title">Negociação</h2>
                <p className="wl-lp-card__sub">Dados da oportunidade</p>
              </div>
              <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" onClick={() => setIsEditingNegotiation((v) => !v)}>
                {isEditingNegotiation ? 'Fechar' : 'Editar'}
              </button>
            </div>

            <div className="wl-dl">
              <div className="wl-stage">
                <div className="wl-stage__top">
                  <span className="wl-label">Etapa atual</span>
                  <span className="wl-pill">{currentStageName}</span>
                </div>
                <StageStepper stages={stages} currentStageIndex={currentStageIndex} onStageClick={handleStageChange} />
              </div>

              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-oportunidade">Nome da oportunidade</label>
                {isEditingNegotiation ? (
                  <input
                    id="lp-oportunidade"
                    className="wl-input"
                    value={editedLead?.opportunityName || ''}
                    onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, opportunityName: e.target.value } : null))}
                  />
                ) : (
                  <span className="wl-dl__value">{lead.opportunityName}</span>
                )}
              </div>

              <div className="wl-dl__item">
                <span className="wl-label">Data de criação</span>
                <span className="wl-dl__value wl-dl__value--num">{createdAtLabel}</span>
              </div>

              <div className="wl-dl__item">
                <span className="wl-label">Responsável</span>
                {isEditingNegotiation && canEditResponsible ? (
                  <Select
                    value={editedLead?.membro_id ? String(editedLead.membro_id) : '__none__'}
                    onValueChange={(value) =>
                      setEditedLead((prev) =>
                        prev ? { ...prev, membro_id: value === '__none__' ? null : value } : null
                      )
                    }
                  >
                    <SelectTrigger className="wl-input" disabled={!membrosLoaded} aria-label="Responsável">
                      <SelectValue placeholder={membrosLoaded ? 'Selecione um responsável' : 'Carregando...'} />
                    </SelectTrigger>
                    <SelectContent className="wl-scope wl-menu">
                      <SelectItem value="__none__" className="wl-menu__item">Sem Responsável</SelectItem>
                      {membros.map((m) => (
                        <SelectItem key={m.membro_id} value={String(m.membro_id)} className="wl-menu__item">
                          {m.membro_nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="wl-dl__value">{responsibleLabel}</span>
                )}
              </div>

              <div className="wl-dl__item wl-field--rel">
                <label className="wl-label" htmlFor="lp-origem">Canal de origem</label>
                {isEditingNegotiation ? (
                  <>
                    <input
                      id="lp-origem"
                      className="wl-input"
                      autoComplete="off"
                      value={editedLead?.source || ''}
                      onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, source: e.target.value } : null))}
                      placeholder="Digite ou selecione uma origem"
                      onFocus={() => setShowOriginSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                    />
                    {showOriginSuggestions && origins.length > 0 && (
                      <div className="wl-suggest">
                        {origins.map((origin, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => setEditedLead((prev) => (prev ? { ...prev, source: origin } : null))}
                          >
                            {origin}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <span className="wl-dl__value">{lead.source || 'N/A'}</span>
                )}
              </div>

              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-valor">Valor da oportunidade</label>
                {isEditingNegotiation ? (
                  <div className="wl-control">
                    <span className="wl-control__prefix wl-control__prefix--solo">R$</span>
                    <input
                      id="lp-valor"
                      className="wl-input wl-input--money"
                      value={formatCurrencyValue(String(Math.round((Number(editedLead?.value ?? 0) * 100))))}
                      onChange={(e) =>
                        setEditedLead((prev) => {
                          const parsed = parseCurrencyToNumber(e.target.value);
                          return prev ? { ...prev, value: parsed } : null;
                        })
                      }
                      inputMode="decimal"
                      placeholder="0,00"
                    />
                  </div>
                ) : (
                  <span className="wl-dl__value wl-dl__value--num">{formatBRL(Number(lead.value) || 0)}</span>
                )}
              </div>

              {isEditingNegotiation && (
                <div className="wl-lp-actions">
                  <button
                    type="button"
                    className="wl-btn wl-btn--glass wl-btn--sm"
                    onClick={() => {
                      setIsEditingNegotiation(false);
                      setEditedLead(lead);
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="button" className="wl-btn wl-btn--glass-ink wl-btn--sm" onClick={handleSaveNegotiation}>
                    Salvar
                  </button>
                </div>
              )}
            </div>
          </section>

          <section className="wl-lp-card" aria-labelledby="lp-extras">
            <div className="wl-lp-card__head">
              <div>
                <h2 id="lp-extras" className="wl-lp-card__title">Informações adicionais</h2>
                <p className="wl-lp-card__sub">Preferências e observações</p>
              </div>
              <button
                type="button"
                className="wl-btn wl-btn--glass wl-btn--sm"
                onClick={() => setIsEditingIAAtiva((v) => !v)}
                disabled={isUpdatingIAAtiva}
              >
                {isEditingIAAtiva ? 'Fechar' : 'Editar'}
              </button>
            </div>

            <div className="wl-dl">
              <div className="wl-dl__item">
                <label className="wl-label" htmlFor="lp-notas">Notas</label>
                {isEditingIAAtiva ? (
                  <textarea
                    id="lp-notas"
                    className="wl-input"
                    value={editedLead?.lead_notas || ''}
                    onChange={(e) =>
                      setEditedLead((prev) => (prev ? { ...prev, lead_notas: e.target.value } : null))
                    }
                    placeholder="Digite as observações do lead"
                  />
                ) : (
                  <span className={`wl-dl__value wl-dl__value--text ${lead.lead_notas ? '' : 'wl-dl__value--soft'}`}>
                    {lead.lead_notas || 'Nenhuma nota disponível'}
                  </span>
                )}
              </div>

              <div className="wl-dl__item">
                <span className="wl-label">IA está ativa?</span>
                {isEditingIAAtiva ? (
                  <>
                    <Select value={iaAtivaValue} onValueChange={(value) => setIaAtivaValue(value as 'Sim' | 'Não')}>
                      <SelectTrigger className="wl-input" aria-label="IA está ativa?">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="wl-scope wl-menu">
                        <SelectItem value="Sim" className="wl-menu__item">Sim</SelectItem>
                        <SelectItem value="Não" className="wl-menu__item">Não</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="wl-lp-actions">
                      <button
                        type="button"
                        className="wl-btn wl-btn--glass wl-btn--sm"
                        onClick={() => {
                          setIsEditingIAAtiva(false);
                          setEditedLead(lead);
                          setIaAtivaValue(normalizeAtivoIA(lead.ativo_ia));
                        }}
                        disabled={isUpdatingIAAtiva}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="wl-btn wl-btn--glass-ink wl-btn--sm"
                        onClick={handleSaveIAAtiva}
                        disabled={isUpdatingIAAtiva}
                      >
                        {isUpdatingIAAtiva ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="wl-dl__value">{normalizeAtivoIA(lead.ativo_ia)}</span>
                )}
              </div>
            </div>
          </section>
        </aside>

        <section className="wl-lp-main" aria-label="Conversa, anotações e tarefas">
          <div className="wl-lp-bar">
            <div className="wl-tabs" role="tablist">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeRightTab === tab.id}
                    className="wl-tab"
                    onClick={() => setActiveRightTab(tab.id)}
                  >
                    <TabIcon />
                    {tab.label}
                    {tab.count > 0 && <span className="wl-tab__count">{tab.count}</span>}
                  </button>
                );
              })}
            </div>

            {activeRightTab === 'anotacoes' && (
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink wl-btn--sm"
                onClick={() => {
                  setNovaAnotacaoTexto('');
                  setNovaAnotacaoFixada(false);
                  setIsNovaAnotacaoDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" width={14} height={14} />
                Adicionar
              </button>
            )}
            {activeRightTab === 'tarefas' && (
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink wl-btn--sm"
                onClick={() => {
                  setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
                  setIsNovaTarefaDialogOpen(true);
                }}
              >
                <Plus aria-hidden="true" width={14} height={14} />
                Adicionar
              </button>
            )}
          </div>

          {activeRightTab === 'conversa' && (
            <div className="wl-chat">
              <ConversationThread
                messages={conversationMessages as any}
                className="h-full overflow-y-auto px-4 py-4 md:px-6"
                style={{
                  backgroundColor: '#efeae2',
                  backgroundImage: "url('/wallpaper%20conversa%20wpp.png')",
                  backgroundRepeat: 'repeat',
                  backgroundPosition: 'top left',
                  backgroundSize: '360px auto',
                }}
                emptyState={
                  <div className="wl-empty" style={{ background: 'transparent' }}>
                    <p className="wl-empty__title">Nenhuma conversa</p>
                    <p className="wl-empty__text">Esse lead não possui conteúdo na coluna conversa.</p>
                  </div>
                }
              />
            </div>
          )}

          {activeRightTab === 'anotacoes' && (
            <div className="wl-lp-list">
              {leadNotas.loading ? (
                <p className="wl-empty__text" style={{ textAlign: 'center', padding: '24px 0' }}>Carregando anotações...</p>
              ) : leadNotas.notas.length === 0 ? (
                <div className="wl-empty">
                  <span className="wl-empty__icon"><StickyNote aria-hidden="true" /></span>
                  <p className="wl-empty__title">Nenhuma anotação</p>
                  <p className="wl-empty__text">Use o botão “Adicionar” para criar a primeira anotação interna deste lead.</p>
                </div>
              ) : (
                leadNotas.notas.map((nota) => {
                  const podeEditar = leadNotas.isAdmin || leadNotas.isMine(nota);
                  const editando = editandoNotaId === nota.anotacao_id;
                  const carregando =
                    leadNotas.loadingAction === `update-${nota.anotacao_id}` ||
                    leadNotas.loadingAction === `delete-${nota.anotacao_id}`;
                  const conteudo = nota.anotacao_conteudo || '';
                  const limiteLinhas = 6;
                  const alturaBaseLinha = 22;
                  const alturaMaxConteudo = limiteLinhas * alturaBaseLinha;
                  const linhasTexto = Math.max(1, conteudo.split('\n').length);
                  const estourou = linhasTexto > limiteLinhas || conteudo.length > limiteLinhas * 90;
                  const expandida = Boolean(notaExpandidaMap[nota.anotacao_id]);
                  return (
                    <article
                      key={nota.anotacao_id}
                      className={`wl-note ${nota.anotacao_fixada ? 'wl-note--pinned' : ''} ${carregando ? 'is-busy' : ''}`}
                    >
                      <div className="wl-note__head">
                        <div className="wl-note__meta">
                          {nota.anotacao_fixada && <span className="wl-tag wl-tag--won">Fixada</span>}
                          <span>{formatDateTimeLabel(nota.criado_em)}</span>
                          <span aria-hidden="true">·</span>
                          <strong>{nota.membro_nome || leadNotas.membroNomeAtual || 'Sem responsável'}</strong>
                          {nota.atualizado_em &&
                            nota.criado_em &&
                            parseTimestamp(nota.atualizado_em).getTime() > parseTimestamp(nota.criado_em).getTime() && (
                              <span>(editado em {formatDateTimeLabel(nota.atualizado_em)})</span>
                            )}
                        </div>
                        <div className="wl-note__tools">
                          <IconAction
                            label={nota.anotacao_fixada ? 'Desafixar anotação' : 'Fixar anotação no topo'}
                            onClick={() => leadNotas.toggleFixada(nota.anotacao_id, nota.anotacao_fixada)}
                            disabled={carregando || !podeEditar}
                          >
                            {nota.anotacao_fixada ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                          </IconAction>
                          {podeEditar && (
                            <>
                              <IconAction label="Editar anotação" onClick={() => handleStartEdit(nota)} disabled={carregando || editando}>
                                <Pencil aria-hidden="true" />
                              </IconAction>
                              <IconAction label="Excluir anotação" onClick={() => setConfirmDeleteId(nota.anotacao_id)} disabled={carregando} danger>
                                <Trash2 aria-hidden="true" />
                              </IconAction>
                            </>
                          )}
                        </div>
                      </div>

                      {editando ? (
                        <div className="wl-modal__stack">
                          <textarea
                            className="wl-input"
                            aria-label="Editar anotação"
                            value={editandoNotaTexto}
                            onChange={(e) => setEditandoNotaTexto(e.target.value)}
                            autoFocus
                          />
                          <div className="wl-lp-actions">
                            <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" onClick={handleCancelEdit} disabled={carregando}>
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="wl-btn wl-btn--glass-ink wl-btn--sm"
                              onClick={handleSaveEdit}
                              disabled={carregando || !editandoNotaTexto.trim()}
                            >
                              {carregando ? 'Salvando...' : 'Salvar'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="wl-modal__stack" style={{ gap: 8 }}>
                          <p className="wl-note__body" style={{ maxHeight: expandida ? 'none' : `${alturaMaxConteudo}px` }}>
                            {conteudo || <span className="wl-note__body--soft">Sem conteúdo.</span>}
                          </p>
                          {estourou && (
                            <button
                              type="button"
                              className="wl-textlink"
                              onClick={() =>
                                setNotaExpandidaMap((prev) => ({ ...prev, [nota.anotacao_id]: !prev[nota.anotacao_id] }))
                              }
                            >
                              {expandida ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                              {expandida ? 'Recolher' : 'Expandir anotação'}
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {activeRightTab === 'tarefas' && (
            <div className="wl-lp-list">
              {leadTarefas.loading ? (
                <p className="wl-empty__text" style={{ textAlign: 'center', padding: '24px 0' }}>Carregando tarefas...</p>
              ) : leadTarefas.tarefas.length === 0 ? (
                <div className="wl-empty">
                  <span className="wl-empty__icon"><ListTodo aria-hidden="true" /></span>
                  <p className="wl-empty__title">Nenhuma tarefa</p>
                  <p className="wl-empty__text">Use o botão “Adicionar” para criar a primeira tarefa deste lead.</p>
                </div>
              ) : (
                leadTarefas.tarefas.map((tarefa) => {
                  const status = getTarefaStatus(tarefa);
                  const tag = TAREFA_TAGS[status] ?? TAREFA_TAGS.sem_prazo;
                  const TagIcon = tag.Icon;
                  const podeEditar = leadTarefas.isAdmin || leadTarefas.isMine(tarefa);
                  const editando = editandoTarefaId === tarefa.tarefa_id;
                  const carregando =
                    leadTarefas.loadingAction === `update-${tarefa.tarefa_id}` ||
                    leadTarefas.loadingAction === `delete-${tarefa.tarefa_id}`;
                  const descricao = tarefa.tarefa_descricao ?? '';
                  const limiteLinhas = 3;
                  const alturaLinha = 22;
                  const alturaMaxDesc = limiteLinhas * alturaLinha;
                  const linhasDesc = Math.max(1, descricao.split('\n').length);
                  const estourou = !!descricao && (linhasDesc > limiteLinhas || descricao.length > limiteLinhas * 100);
                  const expandida = Boolean(tarefaExpandidaMap[tarefa.tarefa_id]);
                  return (
                    <article key={tarefa.tarefa_id} className={`wl-task ${carregando ? 'is-busy' : ''}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={carregando}
                            onClick={() => leadTarefas.toggleConcluida(tarefa.tarefa_id, tarefa.tarefa_concluida)}
                            className={`wl-check ${tarefa.tarefa_concluida ? 'is-on' : ''}`}
                            aria-label={tarefa.tarefa_concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}
                          >
                            {tarefa.tarefa_concluida && <Check aria-hidden="true" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent className="wl-scope wl-tip">
                          {tarefa.tarefa_concluida ? 'Desmarcar concluída' : 'Marcar como concluída'}
                        </TooltipContent>
                      </Tooltip>

                      <div className="wl-min0">
                        <div className="wl-task__top">
                          <div className="wl-min0">
                            <h4 className={`wl-task__title ${tarefa.tarefa_concluida ? 'is-done' : ''}`}>
                              {tarefa.tarefa_titulo || <span className="wl-note__body--soft">Sem título</span>}
                            </h4>
                            <div className="wl-task__meta">
                              <span className={`wl-tag ${tag.cls}`}>
                                <TagIcon aria-hidden="true" />
                                {tag.text}
                              </span>
                              <span>
                                <CalendarDays aria-hidden="true" />
                                Criada em {formatDateTimeLabel(tarefa.criado_em)}
                              </span>
                              {tarefa.data_vencimento && (
                                <span>
                                  <Clock aria-hidden="true" />
                                  Vencimento: <strong>{formatDateTimeVencimento(tarefa.data_vencimento)}</strong>
                                </span>
                              )}
                              <span>
                                Responsável: <strong>{tarefa.membro_nome || leadTarefas.membroNomeAtual || 'Sem responsável'}</strong>
                              </span>
                            </div>
                          </div>
                          {podeEditar && (
                            <div className="wl-note__tools">
                              <IconAction label="Editar tarefa" onClick={() => handleStartEditTarefa(tarefa)} disabled={carregando || editando}>
                                <Pencil aria-hidden="true" />
                              </IconAction>
                              <IconAction label="Excluir tarefa" onClick={() => setConfirmDeleteTarefaId(tarefa.tarefa_id)} disabled={carregando} danger>
                                <Trash2 aria-hidden="true" />
                              </IconAction>
                            </div>
                          )}
                        </div>

                        {editando ? (
                          <div className="wl-task__form">
                            <div className="wl-field">
                              <label className="wl-label" htmlFor={`et-${tarefa.tarefa_id}`}>Título <span className="wl-req">*</span></label>
                              <input
                                id={`et-${tarefa.tarefa_id}`}
                                className="wl-input"
                                value={editandoTarefa.tarefa_titulo}
                                onChange={(e) => setEditandoTarefa((p) => ({ ...p, tarefa_titulo: e.target.value }))}
                                placeholder="Ex: Ligar para cliente"
                                autoFocus
                              />
                            </div>
                            <div className="wl-field">
                              <label className="wl-label" htmlFor={`ed-${tarefa.tarefa_id}`}>Descrição</label>
                              <textarea
                                id={`ed-${tarefa.tarefa_id}`}
                                className="wl-input"
                                value={editandoTarefa.tarefa_descricao}
                                onChange={(e) => setEditandoTarefa((p) => ({ ...p, tarefa_descricao: e.target.value }))}
                                placeholder="Detalhes e observações da tarefa (opcional)"
                              />
                            </div>
                            <div className="wl-field">
                              <label className="wl-label" htmlFor={`ev-${tarefa.tarefa_id}`}>Data e hora de vencimento</label>
                              <input
                                id={`ev-${tarefa.tarefa_id}`}
                                type="datetime-local"
                                className="wl-input"
                                value={editandoTarefa.data_vencimento}
                                onChange={(e) => setEditandoTarefa((p) => ({ ...p, data_vencimento: e.target.value }))}
                              />
                            </div>
                            <div className="wl-lp-actions">
                              <button type="button" className="wl-btn wl-btn--glass wl-btn--sm" onClick={handleCancelEditTarefa} disabled={carregando}>
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="wl-btn wl-btn--glass-ink wl-btn--sm"
                                onClick={handleSaveEditTarefa}
                                disabled={carregando || !String(editandoTarefa.tarefa_titulo || '').trim()}
                              >
                                {carregando ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                          </div>
                        ) : descricao ? (
                          <div className="wl-modal__stack" style={{ gap: 8, marginTop: 10 }}>
                            <p
                              className="wl-note__body wl-note__body--soft"
                              style={{ maxHeight: expandida ? 'none' : `${alturaMaxDesc}px` }}
                            >
                              {descricao}
                            </p>
                            {estourou && (
                              <button
                                type="button"
                                className="wl-textlink"
                                onClick={() =>
                                  setTarefaExpandidaMap((prev) => ({ ...prev, [tarefa.tarefa_id]: !prev[tarefa.tarefa_id] }))
                                }
                              >
                                {expandida ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                                {expandida ? 'Recolher descrição' : 'Expandir descrição'}
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>

      {/* Qualificar */}
      <Dialog open={isQualifyDialogOpen} onOpenChange={setIsQualifyDialogOpen}>
        <DialogContent className="wl-scope wl-modal wl-modal--sm">
          <DialogHeader className="wl-modal__head">
            <DialogTitle className="wl-title wl-title--sm">Deseja qualificar este lead?</DialogTitle>
            <DialogDescription className="wl-lede">
              Ao confirmar a qualificação deste lead, ele será encaminhado para a fila de distribuição de leads e direcionado ao responsável designado para atendimento.
            </DialogDescription>
          </DialogHeader>
          <div className="wl-modal__foot wl-modal__foot--end">
            <div className="wl-modal__foot-actions">
              <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setIsQualifyDialogOpen(false)} disabled={isQualifyingLead}>
                Não
              </button>
              <button type="button" className="wl-btn wl-btn--lime" onClick={handleQualifyLead} disabled={isQualifyingLead}>
                {isQualifyingLead ? 'Enviando...' : 'Sim'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir anotação */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
        <DialogContent className="wl-scope wl-modal wl-modal--sm">
          <DialogHeader className="wl-modal__head">
            <DialogTitle className="wl-title wl-title--sm">Excluir anotação?</DialogTitle>
            <DialogDescription className="wl-lede">
              Essa ação não pode ser desfeita. A anotação será removida permanentemente do lead.
            </DialogDescription>
          </DialogHeader>
          <div className="wl-modal__foot wl-modal__foot--end">
            <div className="wl-modal__foot-actions">
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={() => setConfirmDeleteId(null)}
                disabled={leadNotas.loadingAction?.startsWith('delete-')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wl-btn wl-btn--danger"
                onClick={handleConfirmDelete}
                disabled={leadNotas.loadingAction?.startsWith('delete-')}
              >
                {leadNotas.loadingAction?.startsWith('delete-') ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Excluir tarefa */}
      <Dialog open={!!confirmDeleteTarefaId} onOpenChange={(v) => !v && setConfirmDeleteTarefaId(null)}>
        <DialogContent className="wl-scope wl-modal wl-modal--sm">
          <DialogHeader className="wl-modal__head">
            <DialogTitle className="wl-title wl-title--sm">Excluir tarefa?</DialogTitle>
            <DialogDescription className="wl-lede">
              Essa ação não pode ser desfeita. A tarefa será removida permanentemente do lead.
            </DialogDescription>
          </DialogHeader>
          <div className="wl-modal__foot wl-modal__foot--end">
            <div className="wl-modal__foot-actions">
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={() => setConfirmDeleteTarefaId(null)}
                disabled={leadTarefas.loadingAction?.startsWith('delete-')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wl-btn wl-btn--danger"
                onClick={handleConfirmDeleteTarefa}
                disabled={leadTarefas.loadingAction?.startsWith('delete-')}
              >
                {leadTarefas.loadingAction?.startsWith('delete-') ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova anotação */}
      <Dialog
        open={isNovaAnotacaoDialogOpen}
        onOpenChange={(v) => {
          if (!v && !isCriandoAnotacao) {
            setNovaAnotacaoTexto('');
            setNovaAnotacaoFixada(false);
          }
          if (!isCriandoAnotacao) setIsNovaAnotacaoDialogOpen(v);
        }}
      >
        <DialogContent className="wl-scope wl-modal sm:max-w-[520px]">
          <DialogHeader className="wl-modal__head">
            <DialogTitle className="wl-title wl-title--sm">Nova anotação</DialogTitle>
            <DialogDescription className="wl-lede">
              Crie uma anotação interna sobre este lead. Todos os membros da mesma empresa poderão visualizá-la.
            </DialogDescription>
          </DialogHeader>
          <div className="wl-modal__stack">
            <label className="wl-checkline">
              <input type="checkbox" checked={novaAnotacaoFixada} onChange={(e) => setNovaAnotacaoFixada(e.target.checked)} />
              Fixar no topo
            </label>
            <textarea
              className="wl-input"
              aria-label="Anotação"
              value={novaAnotacaoTexto}
              onChange={(e) => setNovaAnotacaoTexto(e.target.value)}
              placeholder="Digite uma anotação interna sobre este lead..."
              autoFocus
            />
          </div>
          <div className="wl-modal__foot wl-modal__foot--end">
            <div className="wl-modal__foot-actions">
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={() => {
                  setNovaAnotacaoTexto('');
                  setNovaAnotacaoFixada(false);
                  setIsNovaAnotacaoDialogOpen(false);
                }}
                disabled={isCriandoAnotacao}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wl-btn wl-btn--lime"
                onClick={handleCreateNota}
                disabled={isCriandoAnotacao || !novaAnotacaoTexto.trim()}
              >
                {isCriandoAnotacao ? 'Salvando...' : 'Salvar anotação'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Nova tarefa */}
      <Dialog
        open={isNovaTarefaDialogOpen}
        onOpenChange={(v) => {
          if (!v && !isCriandoTarefa) {
            setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
          }
          if (!isCriandoTarefa) setIsNovaTarefaDialogOpen(v);
        }}
      >
        <DialogContent className="wl-scope wl-modal sm:max-w-[520px]">
          <DialogHeader className="wl-modal__head">
            <DialogTitle className="wl-title wl-title--sm">Nova tarefa</DialogTitle>
            <DialogDescription className="wl-lede">
              Crie uma tarefa vinculada a este lead. Defina um título, detalhes e data/hora de vencimento.
            </DialogDescription>
          </DialogHeader>
          <div className="wl-modal__stack">
            <div className="wl-field">
              <label className="wl-label" htmlFor="nt-titulo">Título <span className="wl-req">*</span></label>
              <input
                id="nt-titulo"
                className="wl-input"
                value={novaTarefa.tarefa_titulo}
                onChange={(e) => setNovaTarefa((p) => ({ ...p, tarefa_titulo: e.target.value }))}
                placeholder="Ex: Ligar para cliente e enviar proposta"
                autoFocus
              />
            </div>
            <div className="wl-field">
              <label className="wl-label" htmlFor="nt-desc">Descrição</label>
              <textarea
                id="nt-desc"
                className="wl-input"
                value={novaTarefa.tarefa_descricao}
                onChange={(e) => setNovaTarefa((p) => ({ ...p, tarefa_descricao: e.target.value }))}
                placeholder="Detalhes e observações da tarefa (opcional)"
              />
            </div>
            <div className="wl-field">
              <label className="wl-label" htmlFor="nt-venc">Data e hora de vencimento</label>
              <input
                id="nt-venc"
                type="datetime-local"
                className="wl-input"
                value={novaTarefa.data_vencimento}
                onChange={(e) => setNovaTarefa((p) => ({ ...p, data_vencimento: e.target.value }))}
              />
            </div>
          </div>
          <div className="wl-modal__foot wl-modal__foot--end">
            <div className="wl-modal__foot-actions">
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={() => {
                  setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
                  setIsNovaTarefaDialogOpen(false);
                }}
                disabled={isCriandoTarefa}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="wl-btn wl-btn--lime"
                onClick={handleCreateTarefa}
                disabled={isCriandoTarefa || !novaTarefa.tarefa_titulo.trim()}
              >
                {isCriandoTarefa ? 'Salvando...' : 'Salvar tarefa'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadDetail;
