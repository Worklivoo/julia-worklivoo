import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThumbsUp, ThumbsDown, RotateCcw, Sparkles, Plus, User, ExternalLink, FileText, Power, Star, ArrowLeft, Send, Rocket, Search, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ConversationThread, extractLastMessagePreviewText, getMessagePreviewText, normalizeMessageId, parseLeadsV2Conversa, parseTimestampzToDate, stripAiThinking, toTimestamp } from '@/components/ConversationThread';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase-utils';
import { useToast } from '@/hooks/use-toast';
import { getMembrosByUser, type Membro } from '@/lib/membros';
import { useIsMobile } from '@/hooks/use-mobile';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-chat.css';

// Botão de ícone com dica (cabeçalho da conversa, reações).
const IconTool = ({
  label,
  onClick,
  disabled,
  off,
  className = '',
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  off?: boolean;
  className?: string;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        className={`wl-iconbtn ${off ? 'is-off' : ''} ${className}`.trim()}
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }}
        disabled={disabled}
      >
        {children}
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="wl-scope wl-tip">{label}</TooltipContent>
  </Tooltip>
);

// Selo "este lead recebeu follow-up" na lista (dinâmico: avião; extendido: foguete).
const FollowupBadge = ({ kind, active }: { kind: 'dinamico' | 'extendido'; active?: boolean | null }) => {
  if (!Boolean(active)) return null;
  const label = kind === 'dinamico' ? 'Recebeu FollowUp Dinâmico' : 'Recebeu FollowUp Extendido';
  const Icon = kind === 'dinamico' ? Send : Rocket;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="wl-fu" aria-label={label}>
          <Icon aria-hidden="true" strokeWidth={2.25} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" align="end" className="wl-scope wl-tip">{label}</TooltipContent>
    </Tooltip>
  );
};

type TrainingConversation = {
  treinamento_id?: number
  dify_conversation: string
  dify_user: string
  user_id: string
  membro_id?: string | null
  lead_etapa?: string | null
  lead_canal_origem?: string | null
  ativo_ia?: string | null
  ativo_followup?: string | null
  update_mensagem?: string | null
  created_at?: string | null
  followup_dinamico?: boolean | null
  followup_extendido?: boolean | null
  conversa?: string
}

type MessageItem = {
  id?: string
  content?: string
  answer?: string
  role?: string
  created_at?: string
  reply_to_message_id?: string
  reply_preview?: string
  is_followup_dinamico?: boolean
  is_followup_extendido?: boolean
}

const Conversas = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const isMobile = useIsMobile();


  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [conversations, setConversations] = useState<TrainingConversation[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageItem[]>>({});
  // Prévia (só a última mensagem) de cada conversa, calculada com uma extração leve
  // (extractLastMessagePreviewText) em vez do parser completo. É o que a lista e a
  // busca usam; o parser completo (parseLeadsV2Conversa) só roda sob demanda, para
  // a conversa aberta no momento — ver o efeito de `selectedConvId` mais abaixo.
  const [conversationPreview, setConversationPreview] = useState<Record<string, string>>({});
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, 'up' | 'down'>>({});
  const [togglingAiByConv, setTogglingAiByConv] = useState<Record<string, boolean>>({});
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedOrigins, setSelectedOrigins] = useState<string[]>([]);
  const [companyMembers, setCompanyMembers] = useState<Membro[]>([]);
  const [membersResolved, setMembersResolved] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});
  const [creatingConversation, setCreatingConversation] = useState<'manual' | 'ia' | null>(null);
  const [qualifyDialogOpen, setQualifyDialogOpen] = useState(false);
  const [qualifyingLead, setQualifyingLead] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list');
  const isMobileThreadView = isMobile && mobileView === 'thread';
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const conversationListRef = useRef<HTMLDivElement | null>(null);
  const scrollMessagesToBottom = () => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  };

  const isNumericConversationId = (id: string) => /^\d+$/.test(String(id || ''));

  const formatConversationLastUpdate = (value: unknown) => {
    const d = parseTimestampzToDate(value);
    if (!d) return '';
    const now = new Date();
    const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.floor((startNow - startD) / 86400000);
    const days = Math.max(0, diffDays);

    if (days === 0) {
      return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
    }
    if (days === 1) return 'Ontem';
    if (days >= 2 && days <= 6) {
      const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d);
      return weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';
    }
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
  };

  const isEditableConversation = (conv: TrainingConversation | null | undefined) => {
    if (!conv) return false;
    if (!isNumericConversationId(conv.dify_conversation)) return false;
    const origem = String(conv.lead_canal_origem || '');
    return origem === 'worklivoo-treinamento' || origem === 'worklivoo-treinamento-manual';
  };

  const getLastMessageRoleForConversation = (conversationId: string | null) => {
    if (!conversationId) return null;
    const msgs = messagesByConv[conversationId] || [];
    if (!Array.isArray(msgs) || msgs.length === 0) return null;
    let last = msgs[0];
    let lastTs = toTimestamp(last?.created_at);
    for (const m of msgs) {
      const ts = toTimestamp(m?.created_at);
      if (ts >= lastTs) {
        last = m;
        lastTs = ts;
      }
    }
    return (last?.role || null) as string | null;
  };


  const formatPhone = (raw: string) => {
    const digits = String(raw || '').replace(/\D/g, '');
    let rest = digits.startsWith('55') ? digits.slice(2) : digits;
    const area = rest.slice(0, 2);
    const number = rest.slice(2);
    if (!area || !number) return String(raw || '');
    if (number.length === 9) {
      return `+55 ${area} ${number.slice(0, 5)}-${number.slice(5)}`;
    }
    if (number.length === 8) {
      return `+55 ${area} ${number.slice(0, 4)}-${number.slice(4)}`;
    }
    return `+55 ${area} ${number}`;
  };

  const mask = (t: string | null) => (t ? `${String(t).slice(0,4)}...${String(t).slice(-4)}` : '<missing>');

  const userIdForData = useMemo(() => {
    if (!user) return null;
    return user.isMembro ? (user.user_id_empresa || null) : (user.id || null);
  }, [user]);

  const membroIdForData = useMemo(() => {
    if (!user?.isMembro) return null;
    return user.membroId || null;
  }, [user]);

  const currentUserMember = useMemo(() => {
    const targetMemberId = String(user?.isMembro ? user?.membroId || '' : user?.id || '');
    if (!targetMemberId) return null;
    return companyMembers.find((member) => String(member.membro_id || '') === targetMemberId) || null;
  }, [companyMembers, user]);

  const canUseMemberFilter = currentUserMember?.membro_tipo === 'Administrador';
  const otherActiveMembers = useMemo(
    () => companyMembers.filter((member) => String(member.membro_id || '') !== String(currentUserMember?.membro_id || '')),
    [companyMembers, currentUserMember?.membro_id]
  );
  const showMemberFilter = canUseMemberFilter && otherActiveMembers.length > 0;
  const membroIdQueryFilter = useMemo(() => {
    if (!user?.isMembro) return null;
    if (currentUserMember?.membro_tipo === 'Administrador') return null;
    return currentUserMember?.membro_id || user.membroId || null;
  }, [currentUserMember?.membro_id, currentUserMember?.membro_tipo, user]);

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      if (!userIdForData) {
        if (isMounted) {
          setCompanyMembers([]);
          setMembersResolved(true);
        }
        return;
      }

      setMembersResolved(false);
      const { data, error } = await getMembrosByUser(String(userIdForData));

      if (!isMounted) return;

      if (error || !data) {
        setCompanyMembers([]);
        setMembersResolved(true);
        return;
      }

      const activeMembers = (data as Membro[]).filter((member) => member.membro_status === 'Ativado');
      setCompanyMembers(activeMembers);
      setMembersResolved(true);
    };

    void loadMembers();

    return () => {
      isMounted = false;
    };
  }, [userIdForData]);

  useEffect(() => {
    if (!showMemberFilter && selectedMemberIds.length > 0) {
      setSelectedMemberIds([]);
    }
  }, [showMemberFilter, selectedMemberIds.length]);

  const memberOptions = useMemo(
    () =>
      companyMembers.map((member) => ({
        value: String(member.membro_id),
        label: String(member.membro_nome || '').trim() || 'Sem nome',
        tipo: member.membro_tipo,
      })),
    [companyMembers]
  );

  const selectedMemberLabel = useMemo(() => {
    if (selectedMemberIds.length === 0) return 'Todos os membros';
    if (selectedMemberIds.length === 1) {
      return memberOptions.find((member) => member.value === selectedMemberIds[0])?.label || '1 membro';
    }
    return `${selectedMemberIds.length} membros`;
  }, [memberOptions, selectedMemberIds]);

  const selectedAdminMemberIds = useMemo(
    () =>
      new Set(
        companyMembers
          .filter(
            (member) =>
              selectedMemberIds.includes(String(member.membro_id)) &&
              member.membro_tipo === 'Administrador'
          )
          .map((member) => String(member.membro_id))
      ),
    [companyMembers, selectedMemberIds]
  );

  const matchesSelectedMemberFilter = (memberId: string) => {
    if (selectedMemberIds.length === 0) return true;
    if (selectedMemberIds.includes(memberId)) return true;
    return !memberId && selectedAdminMemberIds.size > 0;
  };

  // Libera o main thread entre lotes/pedaços de processamento pesado, para a lista
  // renderizar progressivamente em vez de travar a tela até tudo terminar.
  const yieldToMain = () =>
    new Promise<void>((resolve) => {
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') {
        w.requestIdleCallback(() => resolve(), { timeout: 50 });
      } else {
        setTimeout(resolve, 0);
      }
    });

  // Busca as conversas em páginas, ordenadas pela mais recente primeiro, e entrega
  // cada página via onPage assim que chega — em vez de esperar buscar as milhares
  // de linhas do usuário de uma vez só antes de mostrar qualquer coisa. Como agora
  // só extraímos a prévia leve por página (ver applyRowsIncrementally), 1000 por
  // página é seguro e reduz o número de idas e vindas ao servidor.
  const CONVERSATIONS_PAGE_SIZE = 1000;
  const fetchLeadsV2TrainingRowsPaged = async (
    uid: string,
    membroId: string | null | undefined,
    onPage: (rows: any[]) => Promise<void> | void
  ) => {
    const supabaseAny = supabase as any;
    let from = 0;
    let to = CONVERSATIONS_PAGE_SIZE - 1;
    while (true) {
      let query = supabaseAny
        .from('leads_v2')
        .select('lead_id,lead_telefone,user_id,membro_id,lead_etapa,conversa,update_mensagem,created_at,lead_canal_origem,ativo_ia,ativo_followup,followup_dinamico,followup_extendido')
        .eq('user_id', uid)
        .order('update_mensagem', { ascending: false, nullsFirst: false })
        .order('lead_id', { ascending: false })
        .range(from, to);
      if (membroId) {
        query = query.eq('membro_id', membroId);
      }
      const { data: rows, error } = await query;
      if (error) break;
      const batch = rows || [];
      if (batch.length > 0) await onPage(batch);
      if (batch.length < CONVERSATIONS_PAGE_SIZE) break;
      from += CONVERSATIONS_PAGE_SIZE;
      to += CONVERSATIONS_PAGE_SIZE;
      await yieldToMain();
    }
  };

  const buildConversationRow = (r: any): TrainingConversation => ({
    dify_conversation: String(r?.lead_id ?? ''),
    dify_user: String(r?.lead_telefone ?? ''),
    user_id: String(r?.user_id ?? ''),
    membro_id: (typeof r?.membro_id === 'undefined' ? null : r.membro_id),
    lead_etapa: (typeof r?.lead_etapa === 'undefined' ? null : r.lead_etapa),
    lead_canal_origem: (typeof r?.lead_canal_origem === 'undefined' ? null : r.lead_canal_origem),
    ativo_ia: (typeof r?.ativo_ia === 'undefined' ? null : r.ativo_ia),
    ativo_followup: (typeof r?.ativo_followup === 'undefined' ? null : r.ativo_followup),
    update_mensagem: (typeof r?.update_mensagem === 'undefined' ? null : r.update_mensagem),
    created_at: (typeof r?.created_at === 'undefined' ? null : r.created_at),
    followup_dinamico: Boolean(r?.followup_dinamico) || (typeof r?.followup_dinamico === 'undefined' ? null : r.followup_dinamico),
    followup_extendido: Boolean(r?.followup_extendido) || (typeof r?.followup_extendido === 'undefined' ? null : r.followup_extendido),
    conversa: String(r?.conversa ?? ''),
  });

  // Processa uma página de linhas em pequenos pedaços, cedendo o main thread entre
  // eles. Calcula só a prévia leve de cada conversa (extractLastMessagePreviewText) —
  // bem mais barata que o parser completo (parseLeadsV2Conversa), que roda apenas
  // para a conversa selecionada (sob demanda), nunca para as milhares da lista.
  const PARSE_CHUNK_SIZE = 250;
  const applyRowsIncrementally = async (
    rows: any[],
    setConvs: React.Dispatch<React.SetStateAction<TrainingConversation[]>>,
    setPreviews: React.Dispatch<React.SetStateAction<Record<string, string>>>
  ) => {
    for (let i = 0; i < rows.length; i += PARSE_CHUNK_SIZE) {
      const slice = rows.slice(i, i + PARSE_CHUNK_SIZE);
      const newConvs: TrainingConversation[] = [];
      const newPreviews: Record<string, string> = {};
      slice.forEach((r: any) => {
        newConvs.push(buildConversationRow(r));
        const leadId = String(r?.lead_id ?? '');
        if (!leadId) return;
        newPreviews[leadId] = extractLastMessagePreviewText(String(r?.conversa ?? ''));
      });

      if (newConvs.length > 0) {
        setConvs((prev) => {
          const seen = new Set(prev.map((c) => c.dify_conversation));
          const additions = newConvs.filter((c) => c.dify_conversation && !seen.has(c.dify_conversation));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
      if (Object.keys(newPreviews).length > 0) {
        setPreviews((prev) => ({ ...prev, ...newPreviews }));
      }

      if (i + PARSE_CHUNK_SIZE < rows.length) await yieldToMain();
    }
  };

  const fetchLeadV2ById = async (leadId: number) => {
    if (!userIdForData) return null;
    const supabaseAny = supabase as any;
    let query = supabaseAny
      .from('leads_v2')
      .select('*')
      .eq('lead_id', leadId)
      .eq('user_id', userIdForData);
    if (membroIdQueryFilter) {
      query = query.eq('membro_id', membroIdQueryFilter);
    }
    const { data, error } = await query.maybeSingle();
    if (error) return null;
    return data || null;
  };

  useEffect(() => {
    const loadConversations = async () => {
      if (!userIdForData || !membersResolved) return;
      setLoading(true);
      setLoadingMore(true);

      let savedSelection: string | null = null;
      try { savedSelection = localStorage.getItem(`tryout:selectedConv:${userIdForData}`); } catch {}

      let firstPageApplied = false;
      let selectionResolved = false;
      const accumulatedIds: string[] = [];

      try {
        await fetchLeadsV2TrainingRowsPaged(String(userIdForData), membroIdQueryFilter, async (rows) => {
          const filtered = rows.filter((r: any) => String(r?.lead_canal_origem || '') !== 'worklivoo-lixo');
          await applyRowsIncrementally(filtered, setConversations, setConversationPreview);
          filtered.forEach((r: any) => {
            const id = String(r?.lead_id ?? '');
            if (id) accumulatedIds.push(id);
          });

          if (!firstPageApplied) {
            firstPageApplied = true;
            // Assim que a primeira página (as conversas mais recentes) já está na
            // tela, liberamos a UI — o resto continua chegando em segundo plano.
            setLoading(false);
          }

          if (!selectionResolved) {
            const candidate = savedSelection && accumulatedIds.includes(savedSelection) ? savedSelection : accumulatedIds[0];
            if (candidate) {
              selectionResolved = true;
              setSelectedConvId(candidate);
            }
          }
        });

        if (!selectionResolved && accumulatedIds.length === 0) {
          setSelectedConvId(null);
        }
      } finally {
        setLoadingMore(false);
        setLoading(false);
      }
    };
    loadConversations();
  }, [membersResolved, membroIdQueryFilter, userIdForData]);

  useEffect(() => {
    if (!isMobile) return;
    if (!selectedConvId) {
      setMobileView('list');
    }
  }, [isMobile, selectedConvId]);

  useEffect(() => {
    if (!userIdForData) return;
    const k = `tryout:feedback:${userIdForData}`;
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setFeedbackByMessage(parsed);
      }
    } catch {}
  }, [userIdForData]);

  useEffect(() => {
    if (!userIdForData) return;
    if (!selectedConvId) return;
    const kSel = `tryout:selectedConv:${userIdForData}`;
    try { localStorage.setItem(kSel, selectedConvId); } catch {}
  }, [userIdForData, selectedConvId]);

  useEffect(() => {
    if (!selectedConvId) return;
    const t = setTimeout(() => {
      scrollMessagesToBottom();
    }, 0);
    return () => clearTimeout(t);
  }, [selectedConvId]);

  // Faz o parse completo (parseLeadsV2Conversa) só da conversa selecionada, quando
  // ainda não foi feito. A lista inteira só carrega a prévia leve (ver
  // applyRowsIncrementally); o histórico completo — com respostas encadeadas, ids
  // de mensagem, badge de FollowUp Dinâmico etc. — só é necessário para a thread
  // aberta na tela, então evitamos gastar isso com conversas que o usuário nunca abre.
  useEffect(() => {
    if (!selectedConvId) return;
    if (messagesByConv[selectedConvId]) return;
    const conv = conversations.find((c) => c.dify_conversation === selectedConvId);
    if (!conv) return;
    const baseTs = toTimestamp(conv.update_mensagem) || toTimestamp(conv.created_at) || Date.now();
    const parsed = parseLeadsV2Conversa(selectedConvId, String(conv.conversa ?? ''), baseTs);
    setMessagesByConv((prev) => (prev[selectedConvId] ? prev : { ...prev, [selectedConvId]: parsed }));
  }, [selectedConvId, conversations]);

  const reloadMessages = async (options?: { showToast?: boolean }) => {
    if (!userIdForData || !membersResolved) return;
    if (loading) return;
    setLoading(true);
    setLoadingMore(true);
    try {
      const showToast = options?.showToast === true;

      // Mantém conversas locais (ainda não numéricas/sincronizadas) e recomeça a
      // lista remota do zero, preenchendo página a página igual ao carregamento inicial.
      setConversations((prev) => prev.filter((c) => !isNumericConversationId(c.dify_conversation)));

      let firstPageApplied = false;
      const accumulatedIds: string[] = [];

      await fetchLeadsV2TrainingRowsPaged(String(userIdForData), membroIdQueryFilter, async (rows) => {
        const filtered = rows.filter((r: any) => String(r?.lead_canal_origem || '') !== 'worklivoo-lixo');
        await applyRowsIncrementally(filtered, setConversations, setConversationPreview);
        filtered.forEach((r: any) => {
          const id = String(r?.lead_id ?? '');
          if (id) accumulatedIds.push(id);
        });

        if (!firstPageApplied) {
          firstPageApplied = true;
          setLoading(false);
          if (!selectedConvId && accumulatedIds.length > 0) {
            setSelectedConvId(accumulatedIds[0]);
          }
        }
      });

      try {
        const supabaseAny = supabase as any;
        const { data: marks } = await supabaseAny
          .from('feedbacks_v2')
          .select('mensagem_id,comentario_tipo')
          .eq('user_id', userIdForData);
        if (Array.isArray(marks)) {
          const next: Record<string, 'up' | 'down'> = {};
          marks.forEach((m: any) => {
            const mid = normalizeMessageId(String(m?.mensagem_id || ''));
            if (!mid) return;
            if (m?.comentario_tipo === 'negativo') next[mid] = 'down';
            if (m?.comentario_tipo === 'positivo') next[mid] = 'up';
          });
          if (Object.keys(next).length > 0) {
            setFeedbackByMessage(next);
            const k = `tryout:feedback:${userIdForData}`;
            try { localStorage.setItem(k, JSON.stringify(next)); } catch {}
          }
        }
      } catch {}
      if (showToast) toast({ title: 'Conversas atualizadas', description: 'Conversas recarregadas com sucesso.' });
    } finally {
      setLoadingMore(false);
      setLoading(false);
    }
  };

  const isLeadAiActive = (ativoIA: unknown) => {
    if (ativoIA === null || typeof ativoIA === 'undefined') return true;
    const v = String(ativoIA).trim().toLowerCase();
    if (!v) return true;
    if (v === 'não' || v === 'nao') return false;
    if (v === 'sim') return true;
    return true;
  };

  const toggleLeadAiActive = async () => {
    if (!userIdForData) return;
    if (!selectedConvId) return;
    const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
    if (!sel) return;
    const origem = String(sel.lead_canal_origem || '');
    if (origem.includes('worklivoo-')) return;
    if (!isNumericConversationId(sel.dify_conversation)) return;
    if (togglingAiByConv[sel.dify_conversation]) return;

    const currentlyActive = isLeadAiActive(sel.ativo_ia);
    const nextValue: 'Sim' | 'Não' = currentlyActive ? 'Não' : 'Sim';
    const nextFollowup: 'TRUE' | 'FALSE' = currentlyActive ? 'FALSE' : 'TRUE';
    const leadId = Number(sel.dify_conversation);
    if (!Number.isFinite(leadId) || leadId <= 0) return;

    setTogglingAiByConv((prev) => ({ ...prev, [sel.dify_conversation]: true }));
    try {
      const supabaseAny = supabase as any;
      const { error } = await supabaseAny
        .from('leads_v2')
        .update({ ativo_ia: nextValue, ativo_followup: nextFollowup })
        .eq('lead_id', leadId);
      if (error) {
        toast({ title: 'Falha ao atualizar', description: 'Não foi possível alterar o status da IA.' });
        return;
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.dify_conversation === sel.dify_conversation ? { ...c, ativo_ia: nextValue, ativo_followup: nextFollowup } : c
        )
      );
      toast({ title: currentlyActive ? 'IA desativada para esse lead' : 'IA ativada para esse lead', description: 'Status atualizado com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível alterar o status da IA.' });
    } finally {
      setTogglingAiByConv((prev) => ({ ...prev, [sel.dify_conversation]: false }));
    }
  };

  const handleQualifySelectedLead = async () => {
    if (!selectedConvId || !userIdForData) return;

    const selectedConversation = conversations.find((x) => x.dify_conversation === selectedConvId);
    const leadId = Number(selectedConversation?.dify_conversation || 0);
    if (!Number.isFinite(leadId) || leadId <= 0) return;

    setQualifyingLead(true);
    try {
      const profile = await getUserProfile(String(userIdForData));
      if (!profile) {
        toast({ title: 'Perfil não encontrado', description: 'Não foi possível localizar o perfil em usuarios_v2.' });
        return;
      }

      const leadRow = await fetchLeadV2ById(leadId);
      if (!leadRow) {
        toast({ title: 'Lead não encontrado', description: 'Não foi possível localizar os dados atualizados do lead para qualificação.' });
        return;
      }

      const payload = {
        dados_entrada: {
          'user_id (Supabase)': String(profile.user_id ?? userIdForData),
          'Token (Uazapi)': String(profile.token_instancia_uazapi ?? ''),
          modo_qualificacao: String(profile.modo_qualificacao ?? ''),
          telefone_qualificado: String(profile.telefone_qualificado ?? ''),
          id_api_whatsapp: String(profile.id_api_whatsapp ?? ''),
          api_oficial: Boolean(profile.api_oficial),
          lead_id: Number((leadRow as any)?.lead_id ?? leadId),
          membro_id: (leadRow as any)?.membro_id ?? null,
          lead_telefone: String((leadRow as any)?.lead_telefone ?? selectedConversation?.dify_user ?? ''),
          lead_nome_pessoa: String((leadRow as any)?.lead_nome_pessoa ?? ''),
        },
        ultimo_historico: String((leadRow as any)?.conversa ?? ''),
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

      const { error: updateError } = await (supabase as any)
        .from('leads_v2')
        .update({
          etapa_fluxo_followup: 'FIM',
          ativo_fluxo_cadencia: 'NAO',
          lead_etapa: 'Oportunidade qualificada',
          ativo_followup: 'FALSE',
        })
        .eq('lead_id', leadId)
        .eq('user_id', userIdForData);

      if (updateError) {
        throw new Error(updateError.message || 'Não foi possível atualizar o lead qualificado.');
      }

      setConversations((prev) =>
        prev.map((conversation) =>
          conversation.dify_conversation === selectedConvId
            ? {
                ...conversation,
                lead_etapa: 'Oportunidade qualificada',
                ativo_followup: 'FALSE',
              }
            : conversation
        )
      );

      setQualifyDialogOpen(false);
      toast({ title: 'Lead qualificado', description: 'O lead foi encaminhado para a fila de distribuição com sucesso.' });
    } catch (error: any) {
      toast({
        title: 'Falha ao qualificar',
        description: error?.message || 'Não foi possível concluir a qualificação do lead.',
      });
    } finally {
      setQualifyingLead(false);
    }
  };

  const createNewConversation = async (mode: 'manual' | 'ia') => {
    if (!userIdForData) return;
    if (creatingConversation) return;
    setCreatingConversation(mode);
    try {
      if (mode === 'ia') {
        const profile = await getUserProfile(String(userIdForData));
        if (!profile) {
          toast({ title: 'Perfil não encontrado', description: 'Não foi possível localizar o usuário em usuarios_v2.' });
          return;
        }

        const webhookUrl = 'https://primary-production-d442.up.railway.app/webhook/15c9f677-5699-446d-b1ed-08079c14aeb0';
        const form = new URLSearchParams();
        Object.entries(profile as any).forEach(([k, v]) => {
          try {
            const key = String(k);
            const val = v == null ? '' : String(v);
            form.append(key, val);
          } catch {}
        });
        form.append('lead_canal_origem', 'worklivoo-treinamento');
        if (user?.isMembro && user.membroId) {
          form.append('membro_id', String(user.membroId));
        }
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: form.toString()
          });
        } catch (e: any) {
          toast({ title: 'Falha no webhook', description: e?.message || 'Não foi possível enviar os dados ao webhook.' });
          return;
        }

        toast({ title: 'Solicitação enviada', description: 'Estamos criando uma nova conversa com IA.' });
        return;
      }

      const supabaseAny = supabase as any;
      const k = `worklivoo:manualPhoneSeed:${String(userIdForData)}`;
      let seed = Date.now();
      try {
        const last = Number(localStorage.getItem(k) || 0);
        if (!Number.isNaN(last) && last >= seed) seed = last + 1;
        localStorage.setItem(k, String(seed));
      } catch {}
      const leadTelefone = `5511${String(seed % 1000000000).padStart(9, '0')}`;
      const now = new Date().toISOString();

      const { data: inserted, error } = await supabaseAny
        .from('leads_v2')
        .insert({
          user_id: String(userIdForData),
          ...(membroIdForData ? { membro_id: String(membroIdForData) } : {}),
          lead_telefone: leadTelefone,
          lead_canal_origem: 'worklivoo-treinamento-manual',
          conversa: '',
          update_mensagem: now,
          TRIAL: 'NÃO',
        })
        .select('lead_id,lead_telefone,user_id')
        .single();

      if (error || !inserted) {
        toast({ title: 'Falha ao criar lead', description: 'Não foi possível criar a conversa manual.' });
        return;
      }

      const conversationId = String(inserted.lead_id);
      const convRow: TrainingConversation = {
        dify_conversation: conversationId,
        dify_user: String(inserted.lead_telefone || leadTelefone),
        user_id: String(inserted.user_id || userIdForData),
        lead_canal_origem: 'worklivoo-treinamento-manual',
        update_mensagem: now,
        conversa: '',
      };

      setConversations((prev) => {
        if (prev.some((c) => c.dify_conversation === conversationId)) return prev;
        return [convRow, ...prev];
      });
      setSelectedConvId(conversationId);
      if (isMobile) setMobileView('thread');
      setMessagesByConv((prev) => ({ ...prev, [conversationId]: [] }));
      setConversationPreview((prev) => ({ ...prev, [conversationId]: '' }));
      toast({ title: 'Conversa manual criada', description: 'Lead criado com sucesso.' });
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível criar a conversa.' });
    } finally {
      setCreatingConversation(null);
    }
  };


  const sendManualMessage = async () => {
    if (!userIdForData) return;
    if (!selectedConvId) return;
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput('');
    setSendingChat(true);
    try {
      const conv = conversations.find((c) => c.dify_conversation === selectedConvId);
      if (!conv) {
        toast({ title: 'Conversa inválida', description: 'Seleção de conversa não encontrada.' });
        return;
      }
      if (!isEditableConversation(conv)) {
        toast({ title: 'Conversa bloqueada', description: 'Envio disponível apenas para conversas de treinamento.' });
        return;
      }
      if (typingByConv[conv.dify_conversation]) {
        toast({ title: 'Aguardando resposta', description: 'Espere a resposta da IA para enviar outra mensagem.' });
        return;
      }
      if (getLastMessageRoleForConversation(conv.dify_conversation) === 'user') {
        toast({ title: 'Aguardando resposta', description: 'Espere a resposta da IA para enviar outra mensagem.' });
        return;
      }

      if (isEditableConversation(conv)) {
        const optimisticUser: MessageItem = { id: `${Date.now()}-q`, role: 'user', content: msg, created_at: String(Date.now()) };
        setMessagesByConv((prev) => {
          const current = prev[conv.dify_conversation] ? [...prev[conv.dify_conversation]] : [];
          current.push(optimisticUser);
          return { ...prev, [conv.dify_conversation]: current };
        });
        setConversationPreview((prev) => ({ ...prev, [conv.dify_conversation]: msg }));
        setTimeout(scrollMessagesToBottom, 0);

        setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: true }));

        const webhookUrl = 'https://primary-production-d442.up.railway.app/webhook/77b9caf8-3b93-400f-b310-5e32b8b87726';
        const leadId = Number(conv.dify_conversation);
        const profile = await getUserProfile(String(userIdForData));
        const leadRow = await fetchLeadV2ById(leadId);
        const payload = {
          usuario: profile,
          lead: leadRow,
          mensagem: {
            texto: msg,
          },
        };

        try {
          const res = await fetch(webhookUrl, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const text = await res.text();
          if (!res.ok || !String(text || '').includes('Respondido!')) {
            toast({ title: 'Aguardando resposta', description: 'Não foi possível confirmar a resposta do agente.' });
            return;
          }
        } catch (webhookErr: any) {
          setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: false }));
          toast({ title: 'Falha no webhook', description: webhookErr?.message || 'Não foi possível enviar a mensagem ao webhook.' });
          return;
        }

        await reloadMessages();
        setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: false }));
        return;
      }

      const { data: keyRow } = await supabase
        .from('usuarios_v2')
        .select('api_agente_dify')
        .eq('user_id', userIdForData)
        .single();
      const apiKey = (keyRow as any)?.api_agente_dify || null;
      if (!apiKey) {
        toast({ title: 'Configuração ausente', description: 'Chave da API não encontrada.' });
        return;
      }
      const API_URL = 'https://api-production-42480.up.railway.app/v1/chat-messages';
      const body = {
        inputs: {},
        query: msg,
        response_mode: 'streaming',
        conversation_id: conv.dify_conversation,
        user: conv.dify_user
      };
      console.log('Dify POST /chat-messages payload:', {
        url: API_URL,
        headers: { Authorization: `Bearer ${mask(apiKey)}`, 'Content-Type': 'application/json' },
        body
      });
      const optimisticUser: MessageItem = { id: `${Date.now()}-q`, role: 'user', content: msg, created_at: String(Date.now()) };
      setMessagesByConv((prev) => {
        const next = { ...prev };
        const arr = next[conv.dify_conversation] ? [...next[conv.dify_conversation]] : [];
        arr.push(optimisticUser);
        next[conv.dify_conversation] = arr;
        return next;
      });
      setTimeout(scrollMessagesToBottom, 0);
      setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: true }));
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        const rawText = await res.text();
        let payload = rawText;
        try {
          const maybeJson = JSON.parse(rawText);
          if (Array.isArray(maybeJson) && maybeJson.length > 0 && typeof maybeJson[0]?.data === 'string') {
            payload = String(maybeJson[0].data || '');
          }
        } catch {}
        const lines = String(payload || '').split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
        const events: any[] = [];
        lines.forEach((j) => { try { const obj = JSON.parse(j); events.push(obj); } catch {} });
        let messageAnswer = '';
        let createdAt: number = Date.now();
        events.forEach((ev) => {
          if (typeof ev?.created_at !== 'undefined') { const t = Number(ev.created_at || 0); if (!Number.isNaN(t)) createdAt = t * 1000; }
          if (ev?.event === 'agent_message' && typeof ev?.answer === 'string') messageAnswer += ev.answer;
        });
        
        messageAnswer = stripAiThinking(messageAnswer);
        const assistantMsg: MessageItem = { id: `${Date.now()}-a`, role: 'assistant', content: messageAnswer, created_at: String(createdAt) };
        setMessagesByConv((prev) => {
          const next = { ...prev };
          const arr = next[conv.dify_conversation] ? [...next[conv.dify_conversation]] : [];
          arr.push(assistantMsg);
          next[conv.dify_conversation] = arr;
          return next;
        });
        setTimeout(scrollMessagesToBottom, 0);
        setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: false }));
        setChatInput('');
      } else {
        const text = await res.text();
        toast({ title: 'Falha ao enviar', description: text || `Status ${res.status}` });
      }
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível enviar a mensagem.' });
    } finally {
      setSendingChat(false);
      try {
        const conv = conversations.find((c) => c.dify_conversation === selectedConvId);
        if (conv) setTypingByConv((prev) => ({ ...prev, [conv.dify_conversation]: false }));
      } catch {}
    }
  };

  const setFeedback = (id: string, type: 'up' | 'down') => {
    if (!userIdForData) return;
    setFeedbackByMessage((prev) => {
      const baseId = normalizeMessageId(id);
      const next = { ...prev, [baseId]: type };
      const k = `tryout:feedback:${userIdForData}`;
      try { localStorage.setItem(k, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const sendPositive = async (messageId: string) => {
    if (!userIdForData) return;
    const messageIdNormalized = normalizeMessageId(String(messageId || ''));
    try {
      const supabaseAny = supabase as any;
      await supabaseAny
        .from('feedbacks_v2')
        .insert({
          user_id: String(userIdForData || ''),
          mensagem_id: messageIdNormalized,
          comentario_tipo: 'positivo',
          comentario_mensagem: null,
          status: true,
        });
    } catch {}
    setFeedback(String(messageId || ''), 'up');
    toast({ title: 'Feedback positivo', description: 'Registrado com sucesso.' });
  };

  const sendFeedback = async () => {
    if (!userIdForData) return;
    if (sendingFeedback) return;
    setSendingFeedback(true);
    try {
      const url = 'https://primary-production-d442.up.railway.app/webhook/777c7b8a-3432-406a-a1b4-62067a964db8';
      const profile = await getUserProfile(userIdForData);
      const conv = conversations.find((c) => c.dify_conversation === selectedConvId) || conversations[0];
      const messageIdNormalized = normalizeMessageId(String(feedbackMessageId || ''));
      const leadId = Number(conv?.dify_conversation || 0);
      const leadRow = Number.isFinite(leadId) && leadId > 0 ? await fetchLeadV2ById(leadId) : null;

      const leadMessages = leadRow
        ? parseLeadsV2Conversa(
            String((leadRow as any)?.lead_id || ''),
            String((leadRow as any)?.conversa || ''),
            toTimestamp((leadRow as any)?.update_mensagem) || toTimestamp((leadRow as any)?.created_at) || Date.now()
          )
        : (selectedConvId ? (messagesByConv[selectedConvId] || []) : []);

      const messageFromDb = leadMessages.find((m) => normalizeMessageId(String(m.id || '')) === messageIdNormalized);
      const mensagemSelecionada = String(messageFromDb?.content || messageFromDb?.answer || '').trim();
      const leadTelefone = String((leadRow as any)?.lead_telefone || conv?.dify_user || '');
      
      // 1. Criar registro no Supabase primeiro
      let createdFeedbackId = '';
      try {
        const supabaseAny = supabase as any;
        const { data: insertedFeedback, error: dbError } = await supabaseAny
          .from('feedbacks_v2')
          .insert({
            user_id: String(userIdForData || ''),
            mensagem_id: messageIdNormalized,
            mensagem_selecionada: mensagemSelecionada,
            comentario_tipo: 'negativo',
            comentario_mensagem: String(feedbackText || ''),
            status: false,
          })
          .select() // Seleciona todas as colunas
          .single();

        if (dbError) {
          console.error('Erro ao inserir feedback:', dbError);
          throw new Error('Falha ao registrar feedback no banco de dados.');
        }
        if (insertedFeedback) {
          // Tipagem segura baseada na definição atualizada
          const feedbackData = insertedFeedback as any;
          createdFeedbackId = String(feedbackData.feedback_id || feedbackData.id || '');
        }
      } catch (dbEx: any) {
        toast({ title: 'Erro ao salvar', description: dbEx.message || 'Não foi possível salvar o feedback.' });
        setSendingFeedback(false);
        return;
      }

      // 2. Enviar Webhook com o ID gerado
      const idempotencyKey = `${String(userIdForData || '')}:${messageIdNormalized}:negativo`;
      const usuarioPayload = (profile && typeof profile === 'object')
        ? { ...(profile as any), user_id: String((profile as any)?.user_id || userIdForData || '') }
        : { user_id: String(userIdForData || '') };

      const mensagemPayload = {
        lead_id: String((leadRow as any)?.lead_id || conv?.dify_conversation || ''),
        lead_telefone: leadTelefone,
        message_id: messageIdNormalized,
        mensagem_selecionada: mensagemSelecionada,
        mensagem_feedback: String(feedbackText || ''),
        idempotency_key: idempotencyKey,
        feedback_id: createdFeedbackId,
      };

      const payload = {
        usuario: usuarioPayload,
        mensagem: mensagemPayload,
        lead: leadRow,
      };

      await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setFeedback(String(feedbackMessageId || ''), 'down');
      toast({ title: 'Feedback enviado', description: 'Vamos analisar e revisar a IA.' });
      setFeedbackModalOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível enviar o feedback.' });
    } finally {
      setSendingFeedback(false);
    }
  };


  const selectedMessages = selectedConvId ? messagesByConv[selectedConvId] || [] : [];
  const orderedConversations = useMemo(() => {
    const arr = [...conversations];
    return arr.sort((a, b) => {
      const al = toTimestamp(a.update_mensagem) || toTimestamp(a.created_at) || 0;
      const bl = toTimestamp(b.update_mensagem) || toTimestamp(b.created_at) || 0;
      return bl - al;
    });
  }, [conversations]);
  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orderedConversations.filter((c) => {
      const origem = String(c.lead_canal_origem || '');
      const matchesOrigin = selectedOrigins.length === 0 || selectedOrigins.includes(origem);
      if (!matchesOrigin) return false;
      const memberId = String(c.membro_id || '').trim();
      const matchesMember = !showMemberFilter || matchesSelectedMemberFilter(memberId);
      if (!matchesMember) return false;
      if (!term) return true;
      const preview = String(conversationPreview[c.dify_conversation] || '').toLowerCase();
      const phoneTitle = formatPhone(c.dify_user || '');
      return phoneTitle.toLowerCase().includes(term) || preview.includes(term);
    });
  }, [conversationPreview, orderedConversations, search, selectedOrigins, selectedMemberIds, selectedAdminMemberIds, showMemberFilter]);

  const originOptions = useMemo(() => {
    const origemSet = new Set<string>();
    conversations.forEach((c) => {
      const origem = String(c.lead_canal_origem || '').trim();
      if (origem) origemSet.add(origem);
    });
    const customOrigins = [...origemSet]
      .filter((o) => o !== 'worklivoo-treinamento' && o !== 'worklivoo-treinamento-manual')
      .sort((a, b) => a.localeCompare(b));
    return [
      { value: 'all', label: 'Todas' },
      ...(origemSet.has('worklivoo-treinamento') ? [{ value: 'worklivoo-treinamento', label: 'Treinamento IA' }] : []),
      ...(origemSet.has('worklivoo-treinamento-manual') ? [{ value: 'worklivoo-treinamento-manual', label: 'Treinamento Manual' }] : []),
      ...customOrigins.map((o) => ({ value: o, label: o })),
    ];
  }, [conversations]);

  const originLabelByValue = useMemo(() => {
    const m = new Map<string, string>();
    originOptions.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [originOptions]);

  const selectedOriginLabel = useMemo(() => {
    if (selectedOrigins.length === 0) return 'Todas';
    if (selectedOrigins.length === 1) return originLabelByValue.get(selectedOrigins[0]) || selectedOrigins[0];
    return `${selectedOrigins.length} origens`;
  }, [originLabelByValue, selectedOrigins]);

  // Com milhares de conversas, renderizar um <button> por conversa (com avatar,
  // badges etc.) trava a rolagem e deixa qualquer atualização da lista lenta —
  // o navegador tem que montar/reconciliar todos os nós de uma vez. O virtualizer
  // só monta no DOM os itens realmente visíveis (+ uma margem de segurança).
  const rowVirtualizer = useVirtualizer({
    count: filteredConversations.length,
    getScrollElement: () => conversationListRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  const selectedConv = conversations.find((x) => x.dify_conversation === selectedConvId) || null;
  const selOrigem = String(selectedConv?.lead_canal_origem || '');
  const selIsTest = selOrigem === 'worklivoo-treinamento' || selOrigem === 'worklivoo-treinamento-manual';
  const selIsRealLead = !selOrigem.includes('worklivoo-');
  const selTitle = selIsTest ? 'TESTE' : formatPhone(selectedConv?.dify_user || '');
  const selAiActive = isLeadAiActive(selectedConv?.ativo_ia);
  const selAiBusy = !!selectedConv?.dify_conversation && !!togglingAiByConv[selectedConv.dify_conversation];
  const selCanQualify = !['oportunidade qualificada', 'orçamento/negociação', 'orcamento/negociacao', 'venda'].includes(
    String(selectedConv?.lead_etapa || '').trim().toLowerCase()
  );
  const canCompose = isEditableConversation(selectedConv);
  const isWaitingReply = !!selectedConvId && !!typingByConv[selectedConvId];
  const composerBlocked = sendingChat || isWaitingReply || getLastMessageRoleForConversation(selectedConvId) === 'user';

  const toggleOrigin = (value: string, checked: boolean) =>
    setSelectedOrigins((prev) => {
      const set = new Set(prev);
      if (checked) set.add(value);
      else set.delete(value);
      return Array.from(set);
    });

  const toggleMember = (value: string, checked: boolean) =>
    setSelectedMemberIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(value);
      else set.delete(value);
      return Array.from(set);
    });

  return (
    <TooltipProvider delayDuration={150}>
      <div className="wl-scope wl-page wl-page--chat">
        <header className={`wl-chat-head ${isMobileThreadView ? 'hidden' : ''}`}>
          <div>
            <p className="wl-eyebrow">Atendimento da Julia</p>
            <h1 className="wl-chat-head__title">Conversas</h1>
            <p className="wl-lede">Analise todas as conversas da IA para melhorar o atendimento.</p>
          </div>
          <div className="wl-chat-head__actions">
            <button
              type="button"
              className="wl-btn wl-btn--glass-ink"
              onClick={() => createNewConversation('manual')}
              disabled={loading || !!creatingConversation}
            >
              <Plus aria-hidden="true" width={16} height={16} />
              Nova manual
            </button>
            <button
              type="button"
              className="wl-btn wl-btn--lime"
              onClick={() => createNewConversation('ia')}
              disabled={loading || !!creatingConversation}
            >
              <Sparkles aria-hidden="true" width={16} height={16} />
              Nova com IA
            </button>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="wl-btn wl-btn--glass wl-btn--icon"
                  aria-label="Recarregar"
                  onClick={() => reloadMessages({ showToast: true })}
                  disabled={loading}
                >
                  <RotateCcw aria-hidden="true" width={16} height={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </TooltipTrigger>
              <TooltipContent className="wl-scope wl-tip">Recarregar</TooltipContent>
            </Tooltip>
          </div>
        </header>

        <div className={`wl-chatwork ${isMobileThreadView ? 'is-thread' : ''}`}>
          {/* Lista de conversas */}
          <aside className={`wl-clist ${isMobile && mobileView === 'thread' ? 'is-hidden' : ''}`}>
            <div className="wl-clist__head">
              <h2 className="wl-clist__title">Conversas</h2>
              <div className="wl-control">
                <Search className="wl-control__icon" aria-hidden="true" />
                <input
                  className="wl-input wl-input--icon"
                  placeholder="Buscar por número ou mensagem"
                  aria-label="Buscar conversas"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="wl-btn wl-btn--glass">
                    <span>{selectedOriginLabel}</span>
                    <ChevronDown aria-hidden="true" width={16} height={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="wl-scope wl-menu w-[320px] max-h-[320px] overflow-y-auto">
                  <DropdownMenuCheckboxItem
                    className="wl-menu__item"
                    checked={selectedOrigins.length === 0}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedOrigins([]);
                    }}
                  >
                    Todas
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator className="wl-menu__sep" />
                  {originOptions
                    .filter((o) => o.value !== 'all')
                    .map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        className="wl-menu__item"
                        checked={selectedOrigins.includes(opt.value)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => toggleOrigin(opt.value, Boolean(checked))}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {showMemberFilter && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="wl-btn wl-btn--glass">
                      <span>{selectedMemberLabel}</span>
                      <ChevronDown aria-hidden="true" width={16} height={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="wl-scope wl-menu w-[320px] max-h-[320px] overflow-y-auto">
                    <DropdownMenuCheckboxItem
                      className="wl-menu__item"
                      checked={selectedMemberIds.length === 0}
                      onSelect={(e) => e.preventDefault()}
                      onCheckedChange={(checked) => {
                        if (checked) setSelectedMemberIds([]);
                      }}
                    >
                      Todos os membros
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator className="wl-menu__sep" />
                    {memberOptions.map((opt) => (
                      <DropdownMenuCheckboxItem
                        key={opt.value}
                        className="wl-menu__item"
                        checked={selectedMemberIds.includes(opt.value)}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => toggleMember(opt.value, Boolean(checked))}
                      >
                        {opt.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            <div ref={conversationListRef} className="wl-clist__scroll">
              <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const c = filteredConversations[virtualRow.index];
                  if (!c) return null;
                  const preview = getMessagePreviewText(String(conversationPreview[c.dify_conversation] || ''));
                  const origem = String(c.lead_canal_origem || '');
                  const title = (origem === 'worklivoo-treinamento' || origem === 'worklivoo-treinamento-manual')
                    ? 'TESTE'
                    : formatPhone(c.dify_user || '');
                  const lastUpdateLabel = formatConversationLastUpdate(c.update_mensagem || c.created_at);
                  const isSelected = selectedConvId === c.dify_conversation;
                  return (
                    <div
                      key={c.dify_conversation}
                      ref={rowVirtualizer.measureElement}
                      data-index={virtualRow.index}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)`, paddingBottom: 4 }}
                    >
                      <button
                        type="button"
                        className={`wl-crow ${isSelected ? 'is-selected' : ''}`}
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => {
                          setSelectedConvId(c.dify_conversation);
                          if (isMobile) setMobileView('thread');
                        }}
                      >
                        <span className="wl-crow__top">
                          <span className="wl-crow__title">{title}</span>
                          <span className="wl-crow__meta">
                            <FollowupBadge kind="dinamico" active={c.followup_dinamico} />
                            <FollowupBadge kind="extendido" active={c.followup_extendido} />
                            {!!lastUpdateLabel && <span className="wl-crow__time">{lastUpdateLabel}</span>}
                          </span>
                        </span>
                        <span className="wl-crow__preview">{preview || '—'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
              {loading && conversations.length === 0 && <p className="wl-clist__note">Carregando...</p>}
              {!loading && loadingMore && <p className="wl-clist__note">Carregando mais conversas…</p>}
              {!loading && !loadingMore && conversations.length === 0 && (
                <p className="wl-clist__note wl-clist__note--center">Nenhuma conversa disponível</p>
              )}
            </div>
          </aside>

          {/* Conversa */}
          <section className={`wl-thread ${isMobile && mobileView === 'list' ? 'is-hidden' : ''}`} aria-label="Mensagens da conversa">
            <header className="wl-thread__head">
              {selectedConvId ? (
                <>
                  {isMobile && (
                    <button type="button" className="wl-iconbtn" aria-label="Voltar para a lista" onClick={() => setMobileView('list')}>
                      <ArrowLeft aria-hidden="true" />
                    </button>
                  )}
                  <span className="wl-thread__avatar" aria-hidden="true"><User /></span>
                  <div className="wl-thread__who">
                    <p className="wl-thread__name">{selTitle}</p>
                    <div className="wl-thread__sub">
                      {selIsRealLead && selOrigem && <span className="wl-pill wl-pill--soft">{selOrigem}</span>}
                      {selIsRealLead && (
                        <span className={`wl-tag ${selAiActive ? 'wl-tag--won' : 'wl-tag--idle'}`}>
                          {selAiActive ? 'IA ativa' : 'IA pausada'}
                        </span>
                      )}
                      {!selIsRealLead && <span className="wl-tag wl-tag--idle">Treinamento</span>}
                    </div>
                  </div>
                  <div className="wl-thread__tools">
                    <IconTool label="Recarregar" onClick={() => reloadMessages({ showToast: true })} disabled={loading}>
                      <RotateCcw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
                    </IconTool>
                    {selIsRealLead && (
                      <>
                        <IconTool
                          label="Abrir WhatsApp"
                          onClick={() => {
                            const phoneDigits = String(selectedConv?.dify_user || '').replace(/\D/g, '');
                            if (!phoneDigits) return;
                            window.open(`https://wa.me/${phoneDigits}`, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink aria-hidden="true" />
                        </IconTool>
                        <IconTool
                          label="Abrir lead"
                          onClick={() => {
                            const leadId = String(selectedConv?.dify_conversation || '').trim();
                            if (!leadId) return;
                            window.open(`/lead/${leadId}`, '_blank');
                          }}
                        >
                          <FileText aria-hidden="true" />
                        </IconTool>
                        {selCanQualify && (
                          <IconTool label="Qualificar lead" onClick={() => setQualifyDialogOpen(true)}>
                            <Star aria-hidden="true" />
                          </IconTool>
                        )}
                        <IconTool
                          label={selAiActive ? 'Desativar a IA' : 'Ativar a IA'}
                          onClick={() => toggleLeadAiActive()}
                          disabled={selAiBusy}
                          off={!selAiActive}
                        >
                          <Power aria-hidden="true" />
                        </IconTool>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <p className="wl-thread__name">Selecione uma conversa</p>
              )}
            </header>

            <ConversationThread
              key={selectedConvId || 'none'}
              messages={selectedConvId ? (selectedMessages as any) : []}
              containerRef={messagesRef}
              className="wl-thread__msgs"
              style={{
                backgroundImage: "url('/wallpaper%20conversa%20wpp.png')",
                backgroundRepeat: 'repeat',
                backgroundSize: '360px auto',
              }}
              emptyState={
                <div className="wl-thread__empty">
                  <div>
                    <p className="wl-empty__title">{selectedConvId ? 'Nenhuma mensagem' : 'Conversas'}</p>
                    <p className="wl-empty__text">
                      {selectedConvId
                        ? 'Clique em “Recarregar” para buscar as mensagens desta conversa.'
                        : 'Escolha uma conversa na lista para visualizar as mensagens.'}
                    </p>
                  </div>
                </div>
              }
              assistantActions={(m, baseId, idx) => (
                <div className="wl-reactrow">
                  <div className="wl-react">
                    <IconTool
                      label="Gostei"
                      className={feedbackByMessage[baseId] === 'up' ? 'is-on' : ''}
                      onClick={() => sendPositive(String(m.id || idx))}
                    >
                      <ThumbsUp aria-hidden="true" />
                    </IconTool>
                    <IconTool
                      label="Não gostei"
                      className={feedbackByMessage[baseId] === 'down' ? 'is-on-down' : ''}
                      onClick={() => {
                        setFeedbackMessageId(String(m.id || idx));
                        setFeedbackText('');
                        setFeedbackModalOpen(true);
                      }}
                    >
                      <ThumbsDown aria-hidden="true" />
                    </IconTool>
                  </div>
                </div>
              )}
              afterMessages={
                canCompose && !!selectedConvId && typingByConv[selectedConvId] ? (
                  <div className="wl-typing" aria-label="A IA está digitando">
                    <div className="wl-typing__bubble">
                      <span className="wl-typing__dot" style={{ animationDelay: '0ms' }} />
                      <span className="wl-typing__dot" style={{ animationDelay: '120ms' }} />
                      <span className="wl-typing__dot" style={{ animationDelay: '240ms' }} />
                    </div>
                  </div>
                ) : null
              }
            />

            {canCompose && (
              <div className="wl-compose">
                <input
                  className="wl-input"
                  placeholder="Digite sua mensagem"
                  aria-label="Mensagem"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !composerBlocked && chatInput.trim()) {
                      e.preventDefault();
                      sendManualMessage();
                    }
                  }}
                  disabled={composerBlocked}
                />
                <button
                  type="button"
                  className="wl-btn wl-btn--glass-ink"
                  onClick={sendManualMessage}
                  disabled={composerBlocked || !chatInput.trim()}
                >
                  <Send aria-hidden="true" width={16} height={16} />
                  Enviar
                </button>
              </div>
            )}
          </section>
        </div>

        <Dialog open={qualifyDialogOpen} onOpenChange={setQualifyDialogOpen}>
          <DialogContent className="wl-scope wl-modal wl-modal--sm">
            <DialogHeader className="wl-modal__head">
              <DialogTitle className="wl-title wl-title--sm">Deseja qualificar este lead?</DialogTitle>
              <DialogDescription className="wl-lede">
                Ao confirmar a qualificação deste lead, ele será encaminhado para a fila de distribuição de leads e direcionado ao responsável designado para atendimento.
              </DialogDescription>
            </DialogHeader>
            <div className="wl-modal__foot wl-modal__foot--end">
              <div className="wl-modal__foot-actions">
                <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setQualifyDialogOpen(false)} disabled={qualifyingLead}>
                  Não
                </button>
                <button type="button" className="wl-btn wl-btn--lime" onClick={handleQualifySelectedLead} disabled={qualifyingLead}>
                  {qualifyingLead ? 'Enviando...' : 'Sim'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
          <DialogContent className="wl-scope wl-modal sm:max-w-[520px]">
            <DialogHeader className="wl-modal__head">
              <DialogTitle className="wl-title wl-title--sm">Fornecer feedback</DialogTitle>
              <DialogDescription className="wl-lede">
                Por favor, explique o que deu errado na mensagem e como gostaria que fosse.
              </DialogDescription>
            </DialogHeader>
            <div className="wl-field">
              <label className="wl-label" htmlFor="feedback-text">Mensagem</label>
              <textarea
                id="feedback-text"
                className="wl-input"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Descreva seu feedback"
              />
            </div>
            <div className="wl-modal__foot wl-modal__foot--end">
              <div className="wl-modal__foot-actions">
                <button type="button" className="wl-btn wl-btn--lime" onClick={sendFeedback} disabled={sendingFeedback}>
                  {sendingFeedback ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default Conversas;
