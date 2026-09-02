import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConversationThread, parseLeadsV2Conversa, parseTimestampzToDate } from '@/components/ConversationThread';
import { useCRM } from '@/contexts/CRMContext';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { useToast } from '@/hooks/use-toast';
import { getMembrosByUser } from '@/lib/membros';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase-utils';
import { Membro } from '@/types';
import { ArrowLeft, Phone, Check, X, UserPlus, FileText, Handshake, MessageCircle, PhoneCall, CheckCircle, Star, CircleDollarSign, StickyNote, ChevronDown, ChevronUp, Pin, PinOff, Pencil, Trash2, Plus, XCircle, Save, ListTodo, Clock, AlertTriangle, CalendarDays } from 'lucide-react';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useLeadNotas } from '@/hooks/use-lead-notas';
import { useLeadTarefas, getTarefaStatus, LeadTarefa } from '@/hooks/use-lead-tarefas';

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
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-primary mb-2 light-title">Carregando...</h1>
          </div>
        </div>
      );
    }
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-primary mb-4 light-title">Lead não encontrado</h1>
        <Button onClick={() => navigate('/leads')}>
          Voltar ao Pipeline
        </Button>
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

  // Barra de etapas minimalista
  function StepProgressBar({
    stages,
    currentStageIndex,
    compact = false,
    micro = false,
    onStageClick,
  }: {
    stages: any[];
    currentStageIndex: number;
    compact?: boolean;
    micro?: boolean;
    onStageClick: (stageId: string) => void;
  }) {
    const sizeClass = micro ? 'h-6 w-6' : compact ? 'h-7 w-7' : 'h-9 w-9';
    const iconSize = micro ? 13 : compact ? 14 : 16;
    const gapClass = micro ? 'gap-1' : compact ? 'gap-1' : 'gap-2';
    const paddingClass = micro ? 'p-2' : compact ? 'p-3' : 'p-4';
    const radiusClass = micro ? 'rounded-lg' : compact ? 'rounded-xl' : 'rounded-2xl';

    return (
      <div className={`${radiusClass} border border-border/60 bg-background/60 ${paddingClass}`}>
        <div className={`flex items-center justify-between ${gapClass}`}>
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = idx === currentStageIndex;
            const isCompleted = idx < currentStageIndex;

            return (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onStageClick(stage.id)}
                        className={`flex ${sizeClass} items-center justify-center rounded-full transition-colors cursor-pointer hover:opacity-90 ${
                          isActive
                            ? 'text-black'
                            : isCompleted
                              ? 'bg-green-600 text-white'
                              : 'bg-muted text-muted-foreground hover:brightness-95'
                        }`}
                        style={isActive ? { backgroundColor: '#EBF57D' } : {}}
                      >
                        {isCompleted ? <CheckCircle size={iconSize} /> : <Icon size={iconSize} />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={4}>
                      <p className="text-[11px]">{stage.name}</p>
                    </TooltipContent>
                  </Tooltip>
                  {!compact && !micro && (
                    <span className={`mt-2 text-[11px] leading-tight text-center ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                      {stage.name}
                    </span>
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className={`h-px flex-1 ${isCompleted ? 'bg-green-600' : 'bg-border'}`}></div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    );
  }

  const statusLabel = lead.status === 'active' ? 'Aberto' : lead.status === 'won' ? 'Ganho' : 'Perdido';
  const statusClasses =
    lead.status === 'won'
      ? 'bg-green-100 text-green-800 hover:bg-green-100'
      : lead.status === 'lost'
        ? 'bg-red-100 text-red-800 hover:bg-red-100'
        : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';

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

  const statusTarefaConfig = (status: ReturnType<typeof getTarefaStatus>) => {
    switch (status) {
      case 'concluida':
        return {
          badgeText: 'Concluída',
          badgeClass: 'bg-green-100 text-green-800 border-0',
          borderClass: 'border-green-300/60 bg-green-50/40',
          leftClass: 'bg-green-400',
          tituloClass: 'line-through text-muted-foreground',
        };
      case 'atrasada':
        return {
          badgeText: 'Atrasada',
          badgeClass: 'bg-red-100 text-red-800 border-0',
          borderClass: 'border-red-300/60 bg-red-50/40',
          leftClass: 'bg-red-400',
          tituloClass: 'text-red-900',
        };
      case 'pendente':
        return {
          badgeText: 'Pendente',
          badgeClass: 'bg-blue-100 text-blue-800 border-0',
          borderClass: 'border-blue-200/60 bg-blue-50/30',
          leftClass: 'bg-blue-400',
          tituloClass: '',
        };
      default:
        return {
          badgeText: 'Sem prazo',
          badgeClass: 'bg-muted/50 text-muted-foreground border-0',
          borderClass: 'border-border/60 bg-muted/10',
          leftClass: 'bg-muted-foreground/40',
          tituloClass: '',
        };
    }
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

  return (
    <div className="h-full transition-colors">
      <div className="flex h-full w-full flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" onClick={() => navigate('/leads')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-2xl font-bold tracking-tight text-foreground">
                {lead.opportunityName}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className={statusClasses}>
                  {statusLabel}
                </Badge>
                <Badge variant="outline" className="font-normal bg-background/60">
                  {stages.find((s) => s.id === lead.stage)?.name || '—'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {lead.status === 'active' && (
              <>
                <Button onClick={handleMarkAsWon} className="h-10 rounded-full gap-2">
                  <Check className="h-4 w-4" />
                  Marcar como Venda
                </Button>
                <Button onClick={handleMarkAsLost} variant="secondary" className="h-10 rounded-full gap-2">
                  <X className="h-4 w-4" />
                  Marcar como Perda
                </Button>
              </>
            )}
            {(lead.status === 'won' || lead.status === 'lost') && (
              <Button onClick={handleResumeNegotiation} variant="secondary" className="h-10 rounded-full">
                Retomar Negociação
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleOpenWhatsApp}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-full"
                  disabled={!String(lead.phone || '').replace(/\D/g, '')}
                >
                  <WhatsAppIcon sx={{ width: 18, height: 18, display: 'block' }} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir WhatsApp</TooltipContent>
            </Tooltip>
            {['entrada', 'tentando-contato', 'contato-realizado'].includes(lead.stage) && (
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                type="button"
                onClick={() => setIsQualifyDialogOpen(true)}
              >
                <Star className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <Dialog open={isQualifyDialogOpen} onOpenChange={setIsQualifyDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deseja qualificar este lead?</DialogTitle>
              <DialogDescription>
                Ao confirmar a qualificação deste lead, ele será encaminhado para a fila de distribuição de leads e direcionado ao responsável designado para atendimento.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setIsQualifyDialogOpen(false)} disabled={isQualifyingLead}>
                Não
              </Button>
              <Button onClick={handleQualifyLead} disabled={isQualifyingLead}>
                {isQualifyingLead ? 'Enviando...' : 'Sim'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out flex-1 min-h-0">
          <div className="grid gap-6 lg:grid-cols-3 h-full">
            <div className="grid gap-5 lg:col-span-1 content-start">
              <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">Contato</CardTitle>
                        <div className="mt-1 text-xs text-muted-foreground">Dados do cliente</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => setIsEditingContact((v) => !v)}
                    >
                      {isEditingContact ? 'Fechar' : 'Editar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Nome do lead</div>
                    {isEditingContact ? (
                      <Input
                        value={editedLead?.leadName || ''}
                        onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, leadName: e.target.value } : null))}
                        className="bg-background border-border rounded-xl"
                      />
                    ) : (
                      <div className="text-sm font-medium">{lead.leadName}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">E-mail</div>
                    {isEditingContact ? (
                      <Input
                        type="email"
                        value={editedLead?.email || ''}
                        onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, email: e.target.value } : null))}
                        className="bg-background border-border rounded-xl"
                      />
                    ) : (
                      <div className="text-sm font-medium truncate">{lead.email || 'N/A'}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Telefone</div>
                    {isEditingContact ? (
                      <Input
                        value={editedLead?.phone || ''}
                        onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, phone: e.target.value } : null))}
                        className="bg-background border-border rounded-xl"
                      />
                    ) : (
                      <div className="text-sm font-medium">{formatPhone(lead.phone)}</div>
                    )}
                  </div>

                  {lead.company && String(lead.company).trim() && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">Empresa</div>
                      <div className="text-sm font-medium">{lead.company}</div>
                    </div>
                  )}

                  {isEditingContact && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button onClick={handleSaveContact} className="h-9 rounded-xl">
                        Salvar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingContact(false);
                          setEditedLead(lead);
                        }}
                        className="h-9 rounded-xl"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                        <Handshake className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">Negociação</CardTitle>
                        <div className="mt-1 text-xs text-muted-foreground">Dados da oportunidade</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => setIsEditingNegotiation((v) => !v)}
                    >
                      {isEditingNegotiation ? 'Fechar' : 'Editar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="mb-1">
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Etapa atual
                      </div>
                      <Badge variant="outline" className="font-normal bg-background/60 h-5 text-[10px]">
                        {stages.find((s) => s.id === lead.stage)?.name || '—'}
                      </Badge>
                    </div>
                    <StepProgressBar
                      stages={stages}
                      currentStageIndex={currentStageIndex}
                      micro
                      onStageClick={handleStageChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Nome da oportunidade</div>
                    {isEditingNegotiation ? (
                      <Input
                        value={editedLead?.opportunityName || ''}
                        onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, opportunityName: e.target.value } : null))}
                        className="bg-background border-border rounded-xl"
                      />
                    ) : (
                      <div className="text-sm font-medium">{lead.opportunityName}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Data de criação</div>
                    <div className="text-sm font-medium">{createdAtLabel}</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Responsável</div>
                    {isEditingNegotiation && canEditResponsible ? (
                      <Select
                        value={editedLead?.membro_id ? String(editedLead.membro_id) : '__none__'}
                        onValueChange={(value) =>
                          setEditedLead((prev) =>
                            prev ? { ...prev, membro_id: value === '__none__' ? null : value } : null
                          )
                        }
                      >
                        <SelectTrigger className="bg-background border-border rounded-xl" disabled={!membrosLoaded}>
                          <SelectValue placeholder={membrosLoaded ? 'Selecione um responsável' : 'Carregando...'} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Sem Responsável</SelectItem>
                          {membros.map((m) => (
                            <SelectItem key={m.membro_id} value={String(m.membro_id)}>
                              {m.membro_nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="text-sm font-medium">{responsibleLabel}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Canal de origem</div>
                    {isEditingNegotiation ? (
                      <div className="relative">
                        <Input
                          value={editedLead?.source || ''}
                          onChange={(e) => setEditedLead((prev) => (prev ? { ...prev, source: e.target.value } : null))}
                          className="bg-background border-border rounded-xl"
                          placeholder="Digite ou selecione uma origem"
                          onFocus={() => setShowOriginSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowOriginSuggestions(false), 200)}
                        />
                        {showOriginSuggestions && origins.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                            {origins.map((origin, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => setEditedLead((prev) => (prev ? { ...prev, source: origin } : null))}
                                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                              >
                                {origin}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm font-medium">{lead.source || 'N/A'}</div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Valor da oportunidade</div>
                    {isEditingNegotiation ? (
                      <div className="flex items-center bg-background border border-border rounded-xl focus-within:ring-1 focus-within:ring-ring focus-within:ring-offset-0 pl-3">
                        <span className="text-sm font-medium text-muted-foreground">R$</span>
                        <Input
                          value={formatCurrencyValue(String(Math.round((Number(editedLead?.value ?? 0) * 100))))}
                          onChange={(e) =>
                            setEditedLead((prev) => {
                              const parsed = parseCurrencyToNumber(e.target.value);
                              return prev ? { ...prev, value: parsed } : null;
                            })
                          }
                          inputMode="decimal"
                          className="border-0 bg-transparent rounded-xl focus-visible:ring-0 focus-visible:ring-offset-0 pl-2"
                          placeholder="0,00"
                        />
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatBRL(Number(lead.value) || 0)}
                      </div>
                    )}
                  </div>

                  {isEditingNegotiation && (
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <Button onClick={handleSaveNegotiation} className="h-9 rounded-xl">
                        Salvar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingNegotiation(false);
                          setEditedLead(lead);
                        }}
                        className="h-9 rounded-xl"
                      >
                        Cancelar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-2xl border border-border/60 bg-card/80 shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">Informações Adicionais</CardTitle>
                        <div className="mt-1 text-xs text-muted-foreground">Preferências e observações</div>
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 rounded-xl"
                      onClick={() => setIsEditingIAAtiva((v) => !v)}
                      disabled={isUpdatingIAAtiva}
                    >
                      {isEditingIAAtiva ? 'Fechar' : 'Editar'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">Notas</div>
                    {isEditingIAAtiva ? (
                      <div className="mt-3">
                        <Textarea
                          value={editedLead?.lead_notas || ''}
                          onChange={(e) =>
                            setEditedLead((prev) =>
                              prev ? { ...prev, lead_notas: e.target.value } : null
                            )
                          }
                          className="min-h-[120px] bg-background border-border rounded-xl"
                          placeholder="Digite as observações do lead"
                        />
                      </div>
                    ) : (
                      <div className="mt-2 text-sm whitespace-pre-wrap">{lead.lead_notas || 'Nenhuma nota disponível'}</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                    <div className="text-xs text-muted-foreground">IA está ativa?</div>
                    {isEditingIAAtiva ? (
                      <div className="mt-3 flex flex-col gap-3">
                        <Select value={iaAtivaValue} onValueChange={(value) => setIaAtivaValue(value as 'Sim' | 'Não')}>
                          <SelectTrigger className="bg-background border-border rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Sim">Sim</SelectItem>
                            <SelectItem value="Não">Não</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-end gap-2">
                          <Button onClick={handleSaveIAAtiva} disabled={isUpdatingIAAtiva} className="h-9 rounded-xl disabled:opacity-50">
                            {isUpdatingIAAtiva ? 'Salvando...' : 'Salvar'}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setIsEditingIAAtiva(false);
                              setEditedLead(lead);
                              setIaAtivaValue(normalizeAtivoIA(lead.ativo_ia));
                            }}
                            disabled={isUpdatingIAAtiva}
                            className="h-9 rounded-xl"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm font-medium">{normalizeAtivoIA(lead.ativo_ia)}</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-5 lg:col-span-2 h-full min-h-0">
              <Card className="rounded-2xl overflow-hidden bg-transparent border-none shadow-none flex flex-col h-full min-h-0">
                <CardHeader className="pb-0 pt-0 shrink-0">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="inline-flex h-10 items-center gap-1 rounded-2xl border border-border/60 bg-muted/40 p-1">
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('conversa')}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-4 text-xs font-medium transition-all ${
                          activeRightTab === 'conversa'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Conversa
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('anotacoes')}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-4 text-xs font-medium transition-all ${
                          activeRightTab === 'anotacoes'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        <StickyNote className="h-3.5 w-3.5" />
                        Anotações
                        {!leadNotas.loading && leadNotas.notas.length > 0 && (
                          <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[9px] font-semibold text-white">
                            {leadNotas.notas.length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRightTab('tarefas')}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-4 text-xs font-medium transition-all ${
                          activeRightTab === 'tarefas'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                        }`}
                      >
                        <ListTodo className="h-3.5 w-3.5" />
                        Tarefas
                        {(() => {
                          const pendentes = leadTarefas.tarefas.filter((t) => {
                            const s = getTarefaStatus(t);
                            return s === 'pendente' || s === 'atrasada' || s === 'sem_prazo';
                          });
                          return !leadTarefas.loading && pendentes.length > 0 ? (
                            <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black/80 px-1 text-[9px] font-semibold text-white">
                              {pendentes.length}
                            </span>
                          ) : null;
                        })()}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {activeRightTab === 'anotacoes' && (
                        <button
                          type="button"
                          className="h-8 inline-flex items-center gap-1.5 pl-2.5 pr-3 rounded-full border-none bg-[#EBF57D] text-xs font-semibold text-black hover:brightness-95 shadow-sm"
                          onClick={() => {
                            setNovaAnotacaoTexto('');
                            setNovaAnotacaoFixada(false);
                            setIsNovaAnotacaoDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar
                        </button>
                      )}
                      {activeRightTab === 'tarefas' && (
                        <button
                          type="button"
                          className="h-8 inline-flex items-center gap-1.5 pl-2.5 pr-3 rounded-full border-none bg-[#EBF57D] text-xs font-semibold text-black hover:brightness-95 shadow-sm"
                          onClick={() => {
                            setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
                            setIsNovaTarefaDialogOpen(true);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 flex-1 min-h-0 flex flex-col">
                  {activeRightTab === 'conversa' && (
                    <div className="overflow-hidden rounded-2xl border border-border/60 h-[calc(92vh-120px)]">
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
                          <div className="flex h-full items-center justify-center">
                            <div className="max-w-md text-center">
                              <div className="text-sm font-semibold">Nenhuma conversa</div>
                              <div className="mt-1 text-sm text-muted-foreground">Esse lead não possui conteúdo na coluna conversa.</div>
                            </div>
                          </div>
                        }
                      />
                    </div>
                  )}

                  {activeRightTab === 'anotacoes' && (
                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-3">
                        {leadNotas.loading ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          Carregando anotações...
                        </div>
                      ) : leadNotas.notas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center">
                          <div className="text-sm font-medium">Nenhuma anotação</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Clique no botão “Adicionar” acima para criar a primeira anotação interna para este lead.
                          </div>
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
                          const estourou =
                            linhasTexto > limiteLinhas || conteudo.length > limiteLinhas * 90;
                          const expandida = Boolean(notaExpandidaMap[nota.anotacao_id]);
                          return (
                            <div
                              key={nota.anotacao_id}
                              className={`rounded-2xl border-none p-4 space-y-3 ${
                                nota.anotacao_fixada
                                  ? 'bg-[#EBF57D]/45 shadow-sm'
                                  : 'bg-[#EBF57D]/25'
                              } ${carregando ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div className="flex flex-wrap items-center gap-2">
                                  {nota.anotacao_fixada && (
                                    <Badge className="h-5 text-[10px] font-semibold bg-[#EBF57D] text-black border-0">
                                      FIXADA
                                    </Badge>
                                  )}
                                  <div className="text-xs font-medium text-muted-foreground">
                                    {formatDateTimeLabel(nota.criado_em)}
                                  </div>
                                  <span className="text-xs text-muted-foreground">—</span>
                                  <div className="text-xs font-medium text-foreground">
                                    {nota.membro_nome || leadNotas.membroNomeAtual || 'Sem responsável'}
                                  </div>
                                  {nota.atualizado_em &&
                                    nota.criado_em &&
                                    parseTimestamp(nota.atualizado_em).getTime() > parseTimestamp(nota.criado_em).getTime() && (
                                      <span className="text-[10px] text-muted-foreground">
                                        (editado em {formatDateTimeLabel(nota.atualizado_em)})
                                      </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-full"
                                        onClick={() => leadNotas.toggleFixada(nota.anotacao_id, nota.anotacao_fixada)}
                                        disabled={carregando || !podeEditar}
                                      >
                                        {nota.anotacao_fixada ? (
                                          <PinOff className="h-4 w-4" />
                                        ) : (
                                          <Pin className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {nota.anotacao_fixada ? 'Desafixar anotação' : 'Fixar anotação no topo'}
                                    </TooltipContent>
                                  </Tooltip>
                                  {podeEditar && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full"
                                            onClick={() => handleStartEdit(nota)}
                                            disabled={carregando || editando}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Editar anotação</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                            onClick={() => setConfirmDeleteId(nota.anotacao_id)}
                                            disabled={carregando}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Excluir anotação</TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                </div>
                              </div>
                              {editando ? (
                                <div className="space-y-3">
                                  <Textarea
                                    value={editandoNotaTexto}
                                    onChange={(e) => setEditandoNotaTexto(e.target.value)}
                                    className="min-h-[120px] bg-background border-border rounded-xl resize-y"
                                    autoFocus
                                  />
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-9 rounded-xl gap-2"
                                      onClick={handleCancelEdit}
                                      disabled={carregando}
                                    >
                                      <XCircle className="h-4 w-4" />
                                      Cancelar
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="h-9 rounded-xl gap-2"
                                      onClick={handleSaveEdit}
                                      disabled={carregando || !editandoNotaTexto.trim()}
                                    >
                                      <Save className="h-4 w-4" />
                                      {carregando ? 'Salvando...' : 'Salvar'}
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div
                                    className="text-sm whitespace-pre-wrap leading-relaxed overflow-hidden"
                                    style={{ maxHeight: expandida ? 'none' : `${alturaMaxConteudo}px` }}
                                  >
                                    {conteudo ? (
                                      conteudo
                                    ) : (
                                      <span className="text-muted-foreground italic">Sem conteúdo.</span>
                                    )}
                                  </div>
                                  {estourou && !editando && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setNotaExpandidaMap((prev) => ({
                                          ...prev,
                                          [nota.anotacao_id]: !prev[nota.anotacao_id],
                                        }))
                                      }
                                      className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                                    >
                                      {expandida ? (
                                        <>
                                          <ChevronUp className="h-3.5 w-3.5" />
                                          Recolher
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="h-3.5 w-3.5" />
                                          Expandir anotação
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <Dialog open={!!confirmDeleteId} onOpenChange={(v) => !v && setConfirmDeleteId(null)}>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Excluir anotação?</DialogTitle>
                          <DialogDescription>
                            Essa ação não pode ser desfeita. A anotação será removida permanentemente do lead.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:justify-end">
                          <Button
                            variant="outline"
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={leadNotas.loadingAction?.startsWith('delete-')}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={leadNotas.loadingAction?.startsWith('delete-')}
                          >
                            {leadNotas.loadingAction?.startsWith('delete-') ? 'Excluindo...' : 'Excluir'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    </div>
                  )}

                  {activeRightTab === 'tarefas' && (
                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                      <div className="space-y-3">
                        {leadTarefas.loading ? (
                        <div className="text-xs text-muted-foreground text-center py-6">
                          Carregando tarefas...
                        </div>
                      ) : leadTarefas.tarefas.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center">
                          <div className="text-sm font-medium">Nenhuma tarefa</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Clique no botão “Adicionar” acima para criar a primeira tarefa para este lead.
                          </div>
                        </div>
                      ) : (
                        leadTarefas.tarefas.map((tarefa) => {
                          const status = getTarefaStatus(tarefa);
                          const conf = statusTarefaConfig(status);
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
                          const estourou =
                            !!descricao && (linhasDesc > limiteLinhas || descricao.length > limiteLinhas * 100);
                          const expandida = Boolean(tarefaExpandidaMap[tarefa.tarefa_id]);
                          const StatusIcon =
                            status === 'concluida'
                              ? CheckCircle
                              : status === 'atrasada'
                                ? AlertTriangle
                                : status === 'pendente'
                                  ? Clock
                                  : CalendarDays;
                          return (
                            <div
                              key={tarefa.tarefa_id}
                              className={`rounded-2xl border ${conf.borderClass} p-4 space-y-3 ${
                                carregando ? 'opacity-60 pointer-events-none' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="pt-0.5 shrink-0">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        disabled={carregando}
                                        onClick={() =>
                                          leadTarefas.toggleConcluida(tarefa.tarefa_id, tarefa.tarefa_concluida)
                                        }
                                        className={`h-5 w-5 rounded-[6px] border-2 grid place-items-center transition-all ${
                                          tarefa.tarefa_concluida
                                            ? 'bg-green-500 border-green-500 text-white'
                                            : 'bg-background border-border hover:border-green-400'
                                        } disabled:opacity-60`}
                                        aria-label={tarefa.tarefa_concluida ? 'Desmarcar como concluída' : 'Marcar como concluída'}
                                      >
                                        {tarefa.tarefa_concluida && <Check className="h-3 w-3" />}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {tarefa.tarefa_concluida ? 'Desmarcar concluída' : 'Marcar como concluída'}
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                                <div className="w-1 self-stretch rounded-full shrink-0 mt-1 mb-1" style={{ backgroundColor: 'rgba(148,163,184,0.2)' }}>
                                  <div className={`w-full rounded-full ${conf.leftClass}`} style={{ minHeight: 24, height: '100%' }} />
                                </div>
                                <div className="flex-1 min-w-0 space-y-2">
                                  <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0 space-y-1 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge className={`h-5 text-[10px] font-semibold ${conf.badgeClass}`}>
                                          <StatusIcon className="h-3 w-3 mr-1" />
                                          {conf.badgeText}
                                        </Badge>
                                        <h4 className={`text-sm font-semibold ${conf.tituloClass}`}>
                                          {tarefa.tarefa_titulo || (
                                            <span className="text-muted-foreground italic">Sem título</span>
                                          )}
                                        </h4>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1">
                                          <CalendarDays className="h-3 w-3" />
                                          <span>
                                            Criada em {formatDateTimeLabel(tarefa.criado_em)}
                                          </span>
                                        </span>
                                        {tarefa.data_vencimento && (
                                          <>
                                            <span className="w-px h-3 bg-border/60" />
                                            <span className="inline-flex items-center gap-1 font-medium">
                                              {status === 'concluida' ? (
                                                <CheckCircle className="h-3 w-3 text-green-600" />
                                              ) : status === 'atrasada' ? (
                                                <AlertTriangle className="h-3 w-3 text-red-600" />
                                              ) : status === 'pendente' ? (
                                                <Clock className="h-3 w-3 text-blue-600" />
                                              ) : (
                                                <CalendarDays className="h-3 w-3 text-muted-foreground" />
                                              )}
                                              Vencimento: {formatDateTimeVencimento(tarefa.data_vencimento)}
                                            </span>
                                          </>
                                        )}
                                        <span className="w-px h-3 bg-border/60" />
                                        <span>
                                          Responsável:{' '}
                                          <span className="font-medium text-foreground">
                                            {tarefa.membro_nome || leadTarefas.membroNomeAtual || 'Sem responsável'}
                                          </span>
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      {podeEditar && (
                                        <>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full"
                                                onClick={() => handleStartEditTarefa(tarefa)}
                                                disabled={carregando || editando}
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Editar tarefa</TooltipContent>
                                          </Tooltip>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                                onClick={() => setConfirmDeleteTarefaId(tarefa.tarefa_id)}
                                                disabled={carregando}
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Excluir tarefa</TooltipContent>
                                          </Tooltip>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {editando ? (
                                    <div className="space-y-3 pt-2">
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                          Título *
                                        </label>
                                        <Input
                                          value={editandoTarefa.tarefa_titulo}
                                          onChange={(e) =>
                                            setEditandoTarefa((p) => ({ ...p, tarefa_titulo: e.target.value }))
                                          }
                                          placeholder="Ex: Ligar para cliente"
                                          className="h-9 rounded-xl"
                                          autoFocus
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                          Descrição
                                        </label>
                                        <Textarea
                                          value={editandoTarefa.tarefa_descricao}
                                          onChange={(e) =>
                                            setEditandoTarefa((p) => ({ ...p, tarefa_descricao: e.target.value }))
                                          }
                                          placeholder="Detalhes e observações da tarefa (opcional)"
                                          className="min-h-[96px] rounded-xl resize-y"
                                        />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-[11px] font-medium text-muted-foreground">
                                          Data e hora de vencimento
                                        </label>
                                        <Input
                                          type="datetime-local"
                                          value={editandoTarefa.data_vencimento}
                                          onChange={(e) =>
                                            setEditandoTarefa((p) => ({ ...p, data_vencimento: e.target.value }))
                                          }
                                          className="h-9 rounded-xl"
                                        />
                                      </div>
                                      <div className="flex items-center justify-end gap-2 pt-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-9 rounded-xl gap-2"
                                          onClick={handleCancelEditTarefa}
                                          disabled={carregando}
                                        >
                                          <XCircle className="h-4 w-4" />
                                          Cancelar
                                        </Button>
                                        <Button
                                          size="sm"
                                          className="h-9 rounded-xl gap-2"
                                          onClick={handleSaveEditTarefa}
                                          disabled={
                                            carregando || !String(editandoTarefa.tarefa_titulo || '').trim()
                                          }
                                        >
                                          <Save className="h-4 w-4" />
                                          {carregando ? 'Salvando...' : 'Salvar'}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : descricao ? (
                                    <div className="space-y-2">
                                      <div
                                        className="text-sm whitespace-pre-wrap leading-relaxed overflow-hidden text-muted-foreground"
                                        style={{ maxHeight: expandida ? 'none' : `${alturaMaxDesc}px` }}
                                      >
                                        {descricao}
                                      </div>
                                      {estourou && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setTarefaExpandidaMap((prev) => ({
                                              ...prev,
                                              [tarefa.tarefa_id]: !prev[tarefa.tarefa_id],
                                            }))
                                          }
                                          className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
                                        >
                                          {expandida ? (
                                            <>
                                              <ChevronUp className="h-3.5 w-3.5" />
                                              Recolher descrição
                                            </>
                                          ) : (
                                            <>
                                              <ChevronDown className="h-3.5 w-3.5" />
                                              Expandir descrição
                                            </>
                                          )}
                                        </button>
                                      )}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <Dialog
                      open={!!confirmDeleteTarefaId}
                      onOpenChange={(v) => !v && setConfirmDeleteTarefaId(null)}
                    >
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Excluir tarefa?</DialogTitle>
                          <DialogDescription>
                            Essa ação não pode ser desfeita. A tarefa será removida permanentemente do lead.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter className="gap-2 sm:justify-end">
                          <Button
                            variant="outline"
                            onClick={() => setConfirmDeleteTarefaId(null)}
                            disabled={leadTarefas.loadingAction?.startsWith('delete-')}
                          >
                            Cancelar
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={handleConfirmDeleteTarefa}
                            disabled={leadTarefas.loadingAction?.startsWith('delete-')}
                          >
                            {leadTarefas.loadingAction?.startsWith('delete-') ? 'Excluindo...' : 'Excluir'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nova anotação</DialogTitle>
                    <DialogDescription>
                      Crie uma anotação interna sobre este lead. Todos os membros da mesma empresa poderão visualizá-la.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={novaAnotacaoFixada}
                        onChange={(e) => setNovaAnotacaoFixada(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                      />
                      Fixar no topo
                    </label>
                    <Textarea
                      value={novaAnotacaoTexto}
                      onChange={(e) => setNovaAnotacaoTexto(e.target.value)}
                      placeholder="Digite uma anotação interna sobre este lead..."
                      className="min-h-[160px] bg-background border-border rounded-xl resize-y"
                      autoFocus
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNovaAnotacaoTexto('');
                        setNovaAnotacaoFixada(false);
                        setIsNovaAnotacaoDialogOpen(false);
                      }}
                      disabled={isCriandoAnotacao}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateNota}
                      disabled={isCriandoAnotacao || !novaAnotacaoTexto.trim()}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isCriandoAnotacao ? 'Salvando...' : 'Salvar anotação'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={isNovaTarefaDialogOpen}
                onOpenChange={(v) => {
                  if (!v && !isCriandoTarefa) {
                    setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
                  }
                  if (!isCriandoTarefa) setIsNovaTarefaDialogOpen(v);
                }}
              >
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nova tarefa</DialogTitle>
                    <DialogDescription>
                      Crie uma tarefa vinculada a este lead. Defina um título, detalhes e data/hora de vencimento.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Título *
                      </label>
                      <Input
                        value={novaTarefa.tarefa_titulo}
                        onChange={(e) =>
                          setNovaTarefa((p) => ({ ...p, tarefa_titulo: e.target.value }))
                        }
                        placeholder="Ex: Ligar para cliente e enviar proposta"
                        className="h-10 rounded-xl"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Descrição
                      </label>
                      <Textarea
                        value={novaTarefa.tarefa_descricao}
                        onChange={(e) =>
                          setNovaTarefa((p) => ({ ...p, tarefa_descricao: e.target.value }))
                        }
                        placeholder="Detalhes e observações da tarefa (opcional)"
                        className="min-h-[120px] rounded-xl resize-y"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Data e hora de vencimento
                      </label>
                      <Input
                        type="datetime-local"
                        value={novaTarefa.data_vencimento}
                        onChange={(e) =>
                          setNovaTarefa((p) => ({ ...p, data_vencimento: e.target.value }))
                        }
                        className="h-10 rounded-xl"
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setNovaTarefa({ tarefa_titulo: '', tarefa_descricao: '', data_vencimento: '' });
                        setIsNovaTarefaDialogOpen(false);
                      }}
                      disabled={isCriandoTarefa}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateTarefa}
                      disabled={isCriandoTarefa || !novaTarefa.tarefa_titulo.trim()}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {isCriandoTarefa ? 'Salvando...' : 'Salvar tarefa'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;
