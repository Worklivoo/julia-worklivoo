import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ThumbsUp, ThumbsDown, RotateCcw, MessageCircle, Smartphone, Sparkles, Plus, User, ExternalLink, FileText, Power, Star, ArrowLeft, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConversationThread, normalizeMessageId, parseLeadsV2Conversa, parseTimestampzToDate, stripAiThinking, toTimestamp } from '@/components/ConversationThread';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase-utils';
import { useToast } from '@/hooks/use-toast';
import { getMembrosByUser, type Membro } from '@/lib/membros';
import { useIsMobile } from '@/hooks/use-mobile';

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
}

const Conversas = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const FollowupDinamicoBadge: React.FC<{ active?: boolean | null }> = ({ active }) => {
    if (!Boolean(active)) return null;
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              aria-label="Este lead recebeu FollowUp Dinâmico"
              title="Este lead recebeu FollowUp Dinâmico"
              className="relative inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-1 ring-amber-500/25 shadow-[0_1px_2px_rgba(0,0,0,0.04)] bg-gradient-to-br from-amber-200 via-orange-200 to-rose-200 text-amber-900 dark:from-amber-500/30 dark:via-orange-500/30 dark:to-rose-500/30 dark:text-amber-100"
            >
              <Send strokeWidth={2.25} className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" align="end" className="text-xs">
            Recebeu FollowUp Dinâmico
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [conversations, setConversations] = useState<TrainingConversation[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageItem[]>>({});
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

  const isManualConversation = (conv: TrainingConversation | null | undefined) => {
    if (!conv) return false;
    if (String(conv.lead_canal_origem || '') === 'worklivoo-treinamento-manual') return true;
    return typeof conv.dify_user === 'string' && conv.dify_user.startsWith('worklivoo-manual-');
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

  const getConversationColorClasses = (conv: TrainingConversation, isSelected: boolean) => {
    const origem = String(conv.lead_canal_origem || '');
    if (origem === 'worklivoo-treinamento-manual') {
      return isSelected
        ? 'bg-[#EBF57D] ring-1 ring-primary/25'
        : 'bg-[#EBF57D]/20 hover:bg-[#EBF57D]/35';
    }
    if (origem === 'worklivoo-treinamento') {
      return isSelected
        ? 'bg-sky-500/15 ring-1 ring-sky-400/40'
        : 'bg-sky-500/5 hover:bg-sky-500/10';
    }
    return isSelected
      ? 'bg-muted ring-1 ring-primary/25'
      : 'hover:bg-muted/60';
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

  // Busca as conversas em páginas menores, ordenadas pela mais recente primeiro,
  // e entrega cada página via onPage assim que chega — em vez de esperar buscar
  // as milhares de linhas do usuário de uma vez só antes de mostrar qualquer coisa.
  const CONVERSATIONS_PAGE_SIZE = 300;
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
        .select('lead_id,lead_telefone,user_id,membro_id,lead_etapa,conversa,update_mensagem,created_at,lead_canal_origem,ativo_ia,ativo_followup,followup_dinamico')
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
  });

  // Processa uma página de linhas em pequenos pedaços, cedendo o main thread entre
  // eles. O parse de `conversa` (parseLeadsV2Conversa) é a parte mais cara — com
  // milhares de conversas, fazer tudo de uma vez trava a aba até terminar.
  const PARSE_CHUNK_SIZE = 40;
  const applyRowsIncrementally = async (
    rows: any[],
    setConvs: React.Dispatch<React.SetStateAction<TrainingConversation[]>>,
    setMsgs: React.Dispatch<React.SetStateAction<Record<string, MessageItem[]>>>
  ) => {
    for (let i = 0; i < rows.length; i += PARSE_CHUNK_SIZE) {
      const slice = rows.slice(i, i + PARSE_CHUNK_SIZE);
      const newConvs: TrainingConversation[] = [];
      const newMsgs: Record<string, MessageItem[]> = {};
      slice.forEach((r: any) => {
        newConvs.push(buildConversationRow(r));
        const leadId = String(r?.lead_id ?? '');
        if (!leadId) return;
        const baseTs = toTimestamp(r?.update_mensagem) || toTimestamp(r?.created_at) || Date.now();
        newMsgs[leadId] = parseLeadsV2Conversa(leadId, String(r?.conversa ?? ''), baseTs);
      });

      if (newConvs.length > 0) {
        setConvs((prev) => {
          const seen = new Set(prev.map((c) => c.dify_conversation));
          const additions = newConvs.filter((c) => c.dify_conversation && !seen.has(c.dify_conversation));
          return additions.length > 0 ? [...prev, ...additions] : prev;
        });
      }
      if (Object.keys(newMsgs).length > 0) {
        setMsgs((prev) => ({ ...prev, ...newMsgs }));
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
          await applyRowsIncrementally(filtered, setConversations, setMessagesByConv);
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
    const main = document.querySelector('.main-content') as HTMLElement | null;
    if (!main) return;
    const prev = {
      paddingLeft: main.style.paddingLeft,
      paddingRight: main.style.paddingRight,
      paddingTop: main.style.paddingTop,
      paddingBottom: main.style.paddingBottom,
      height: main.style.height,
      overflow: main.style.overflow,
    };
    main.style.paddingLeft = isMobile ? '0' : prev.paddingLeft;
    main.style.paddingRight = isMobile ? '0' : prev.paddingRight;
    main.style.paddingTop = isMobile ? '80px' : '0';
    main.style.paddingBottom = '0';
    if (isMobile) {
      if (isMobileThreadView) {
        main.style.height = 'calc(100dvh - 80px)';
        main.style.overflow = 'hidden';
      } else {
        main.style.height = 'auto';
        main.style.overflow = 'auto';
      }
    } else {
      main.style.height = '100dvh';
      main.style.overflow = 'hidden';
    }
    return () => {
      main.style.paddingLeft = prev.paddingLeft;
      main.style.paddingRight = prev.paddingRight;
      main.style.paddingTop = prev.paddingTop;
      main.style.paddingBottom = prev.paddingBottom;
      main.style.height = prev.height;
      main.style.overflow = prev.overflow;
    };
  }, [isMobile, isMobileThreadView]);

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
        await applyRowsIncrementally(filtered, setConversations, setMessagesByConv);
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
      };

      setConversations((prev) => {
        if (prev.some((c) => c.dify_conversation === conversationId)) return prev;
        return [convRow, ...prev];
      });
      setSelectedConvId(conversationId);
      if (isMobile) setMobileView('thread');
      setMessagesByConv((prev) => ({ ...prev, [conversationId]: [] }));
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
      const msgs = messagesByConv[c.dify_conversation] || [];
      const last = msgs[msgs.length - 1];
      const preview = stripAiThinking((last?.content || last?.answer || '').toString()).toLowerCase();
      const phoneTitle = formatPhone(c.dify_user || '');
      return phoneTitle.toLowerCase().includes(term) || preview.includes(term);
    });
  }, [messagesByConv, orderedConversations, search, selectedOrigins, selectedMemberIds, selectedAdminMemberIds, showMemberFilter]);

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

  return (
    <div className={`${isMobileThreadView ? 'h-[calc(100dvh-80px)] min-h-0 overflow-hidden' : 'min-h-[calc(100dvh-80px)] bg-background'} md:h-[100vh] md:min-h-0 md:overflow-hidden`}>
      <div className={`${isMobileThreadView ? 'h-[calc(100dvh-80px)] min-h-0' : 'min-h-[calc(100dvh-80px)]'} p-2 md:h-full md:min-h-0 md:p-6`}>
        <Card className={`${isMobileThreadView ? 'h-[calc(100dvh-96px)] min-h-0' : 'min-h-[calc(100dvh-96px)]'} overflow-hidden rounded-[22px] border-border/60 bg-card/70 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/60 md:h-full md:min-h-0 md:rounded-3xl`}>
          <CardContent className={`${isMobileThreadView ? 'h-[calc(100dvh-96px)] min-h-0' : 'min-h-[calc(100dvh-96px)]'} flex flex-col overflow-hidden p-0 md:h-full md:min-h-0`}>
            <div className={`${isMobileThreadView ? 'hidden' : 'flex'} flex-col gap-3 border-b border-border/70 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4`}>
              <div className="min-w-0">
                <div className="truncate text-base font-semibold tracking-tight md:text-lg">Todas as conversas da IA</div>
                <div className="text-xs text-muted-foreground">Analise todas as conversas da IA para melhorar o atendimento</div>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:items-center">
                <Button
                  variant="secondary"
                  onClick={() => createNewConversation('manual')}
                  disabled={loading || !!creatingConversation}
                  className="h-10 gap-2 rounded-full md:min-w-[140px]"
                >
                  <Plus className="h-4 w-4" />
                  Nova manual
                </Button>
                <Button
                  onClick={() => createNewConversation('ia')}
                  disabled={loading || !!creatingConversation}
                  className="h-10 gap-2 rounded-full md:min-w-[140px]"
                >
                  <Sparkles className="h-4 w-4" />
                  Nova com IA
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => reloadMessages({ showToast: true })}
                        disabled={loading}
                        className="h-10 w-full rounded-full sm:w-10"
                      >
                        <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Recarregar</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div className={`${isMobile && mobileView === 'thread' ? 'hidden' : 'flex'} w-full min-h-0 flex-col border-b border-border/70 bg-muted/20 md:flex md:w-[360px] md:border-b-0 md:border-r`}>
                <div className="sticky top-0 z-10 bg-background/70 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-5 md:py-4">
                  <div className="mb-2 text-sm font-semibold">Conversas</div>
                  <Input
                    placeholder="Buscar por número ou mensagem"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 bg-background/80"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="mt-2 h-9 w-full justify-between rounded-md border border-input bg-background/80 px-2 text-sm font-normal"
                      >
                        {selectedOriginLabel}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[320px] max-h-[320px] overflow-y-auto">
                      <DropdownMenuCheckboxItem
                        checked={selectedOrigins.length === 0}
                        onSelect={(e) => e.preventDefault()}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedOrigins([]);
                        }}
                      >
                        Todas
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuSeparator />
                      {originOptions
                        .filter((o) => o.value !== 'all')
                        .map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt.value}
                            checked={selectedOrigins.includes(opt.value)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(checked) => {
                              setSelectedOrigins((prev) => {
                                const set = new Set(prev);
                                if (checked) set.add(opt.value);
                                else set.delete(opt.value);
                                return Array.from(set);
                              });
                            }}
                          >
                            {opt.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {showMemberFilter && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="mt-2 h-9 w-full justify-between rounded-md border border-input bg-background/80 px-2 text-sm font-normal"
                        >
                          {selectedMemberLabel}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-[320px] max-h-[320px] overflow-y-auto">
                        <DropdownMenuCheckboxItem
                          checked={selectedMemberIds.length === 0}
                          onSelect={(e) => e.preventDefault()}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedMemberIds([]);
                          }}
                        >
                          Todos os membros
                        </DropdownMenuCheckboxItem>
                        <DropdownMenuSeparator />
                        {memberOptions.map((opt) => (
                          <DropdownMenuCheckboxItem
                            key={opt.value}
                            checked={selectedMemberIds.includes(opt.value)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={(checked) => {
                              setSelectedMemberIds((prev) => {
                                const set = new Set(prev);
                                if (checked) set.add(opt.value);
                                else set.delete(opt.value);
                                return Array.from(set);
                              });
                            }}
                          >
                            {opt.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Separator />
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 md:px-3 md:py-3">
                  {filteredConversations.map((c) => {
                    const msgs = messagesByConv[c.dify_conversation] || [];
                    const last = msgs[msgs.length - 1];
                    const preview = stripAiThinking((last?.content || last?.answer || '').toString());
                    const origem = String(c.lead_canal_origem || '');
                    const title = (origem === 'worklivoo-treinamento' || origem === 'worklivoo-treinamento-manual')
                      ? 'TESTE'
                      : formatPhone(c.dify_user || '');
                    const lastUpdateLabel = formatConversationLastUpdate(c.update_mensagem || c.created_at);
                    const isSelected = selectedConvId === c.dify_conversation;
                    const colorClasses = getConversationColorClasses(c, isSelected);
                    return (
                      <button
                        key={c.dify_conversation}
                        className={`group flex min-h-[76px] w-full items-center rounded-2xl border border-border/40 px-3 py-3 text-left transition-colors ${colorClasses} ${filteredConversations.length > 1 ? 'mb-2' : ''}`}
                        onClick={() => {
                          setSelectedConvId(c.dify_conversation);
                          if (isMobile) setMobileView('thread');
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-background/60">
                              <Smartphone className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <FollowupDinamicoBadge active={c.followup_dinamico} />
                                {!!lastUpdateLabel && (
                                  <div className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                    {lastUpdateLabel}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="line-clamp-1 text-xs text-muted-foreground group-hover:text-muted-foreground/90">{preview || '—'}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {loading && conversations.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
                  )}
                  {!loading && loadingMore && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Carregando mais conversas…</div>
                  )}
                  {!loading && !loadingMore && conversations.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhuma conversa disponível</div>
                  )}
                </div>
              </div>
              <div className={`${isMobile && mobileView === 'list' ? 'hidden' : 'flex'} min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-b from-background to-muted/20 md:flex`}>
                <div className="sticky top-0 z-10 flex-shrink-0 border-b border-border/70 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-3 px-4 py-3 md:px-6">
                    {selectedConvId ? (
                      <>
                        {isMobile && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 rounded-full md:hidden"
                            onClick={() => setMobileView('list')}
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </Button>
                        )}
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-muted/50">
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              {(() => {
                                const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                const origem = String(sel?.lead_canal_origem || '');
                                return (origem === 'worklivoo-treinamento' || origem === 'worklivoo-treinamento-manual')
                                  ? 'TESTE'
                                  : formatPhone(sel?.dify_user || '');
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground">Mensagens</div>
                          </div>
                          <div className="flex items-center gap-1 rounded-full bg-background/70 p-1 shadow-sm ring-1 ring-border/60">
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => reloadMessages({ showToast: true })}
                                    disabled={loading}
                                  >
                                    <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Recarregar</TooltipContent>
                              </Tooltip>
                              {(() => {
                                const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                const origem = String(sel?.lead_canal_origem || '');
                                if (origem.includes('worklivoo-')) return null;
                                return (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-full"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                            const rawPhone = String(sel?.dify_user || '');
                                            const phoneDigits = rawPhone.replace(/\D/g, '');
                                            if (!phoneDigits) return;
                                            window.open(`https://wa.me/${phoneDigits}`, '_blank', 'noopener,noreferrer');
                                          }}
                                        >
                                          <ExternalLink className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Abrir WhatsApp</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8 rounded-full"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                            const leadId = String(sel?.dify_conversation || '').trim();
                                            if (!leadId) return;
                                            window.open(`/lead/${leadId}`, '_blank');
                                          }}
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Abrir Lead</TooltipContent>
                                    </Tooltip>
                                    {(() => {
                                      const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                      const leadEtapa = String(sel?.lead_etapa || '').trim().toLowerCase();
                                      if (['oportunidade qualificada', 'orçamento/negociação', 'orcamento/negociacao', 'venda'].includes(leadEtapa)) return null;
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 rounded-full"
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setQualifyDialogOpen(true);
                                              }}
                                            >
                                              <Star className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Qualificar Lead</TooltipContent>
                                        </Tooltip>
                                      );
                                    })()}
                                    {(() => {
                                      const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                                      const active = isLeadAiActive(sel?.ativo_ia);
                                      const busy = !!sel?.dify_conversation && !!togglingAiByConv[sel.dify_conversation];
                                      return (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className={`h-8 w-8 rounded-full ${active ? 'text-green-600 hover:bg-green-500/10' : 'text-red-600 hover:bg-red-500/10'}`}
                                              onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleLeadAiActive();
                                              }}
                                              disabled={busy}
                                            >
                                              <Power className="h-4 w-4" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>{active ? 'Desativar a IA' : 'Ativar a IA'}</TooltipContent>
                                        </Tooltip>
                                      );
                                    })()}
                                  </>
                                );
                              })()}
                            </TooltipProvider>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm font-semibold">Selecione uma conversa</div>
                    )}
                  </div>
                </div>
                <Dialog open={qualifyDialogOpen} onOpenChange={setQualifyDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Deseja qualificar este lead?</DialogTitle>
                      <DialogDescription>
                        Ao confirmar a qualificação deste lead, ele será encaminhado para a fila de distribuição de leads e direcionado ao responsável designado para atendimento.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                      <Button variant="outline" onClick={() => setQualifyDialogOpen(false)} disabled={qualifyingLead}>
                        Não
                      </Button>
                      <Button onClick={handleQualifySelectedLead} disabled={qualifyingLead}>
                        {qualifyingLead ? 'Enviando...' : 'Sim'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <ConversationThread
                  key={selectedConvId || 'none'}
                  messages={selectedConvId ? (selectedMessages as any) : []}
                  containerRef={messagesRef}
                  className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6"
                  style={{
                    backgroundImage: "url('/wallpaper%20conversa%20wpp.png')",
                    backgroundRepeat: 'repeat',
                    backgroundSize: '360px auto',
                  }}
                  emptyState={
                    selectedConvId ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="max-w-md text-center">
                          <div className="text-sm font-semibold">Nenhuma mensagem</div>
                          <div className="mt-1 text-sm text-muted-foreground">Clique em “Recarregar” para buscar as mensagens desta conversa.</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="max-w-md text-center">
                          <div className="text-sm font-semibold">Conversas</div>
                          <div className="mt-1 text-sm text-muted-foreground">Escolha uma conversa na lista para visualizar as mensagens.</div>
                        </div>
                      </div>
                    )
                  }
                  assistantActions={(m, baseId, idx) => (
                    <div className="-mt-2.5 flex justify-end pr-2">
                      <div className="inline-flex items-center gap-0.5 rounded-full bg-background/80 px-0.5 py-0.5 shadow-sm ring-1 ring-border/60">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-6 w-6 p-0 transition-transform ${feedbackByMessage[baseId] === 'up' ? 'scale-105' : ''}`}
                                onClick={() => sendPositive(String(m.id || idx))}
                              >
                                <ThumbsUp className={`h-3 w-3 ${feedbackByMessage[baseId] === 'up' ? 'text-green-600' : 'text-muted-foreground'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Gostei</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={`h-6 w-6 p-0 transition-transform ${feedbackByMessage[baseId] === 'down' ? 'scale-105' : ''}`}
                                onClick={() => {
                                  setFeedbackMessageId(String(m.id || idx));
                                  setFeedbackText('');
                                  setFeedbackModalOpen(true);
                                }}
                              >
                                <ThumbsDown className={`h-3 w-3 ${feedbackByMessage[baseId] === 'down' ? 'text-red-600' : 'text-muted-foreground'}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Não gostei</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  )}
                  afterMessages={
                    (() => {
                      const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                      const manual = isEditableConversation(sel);
                      const typing = !!selectedConvId && typingByConv[selectedConvId];
                      if (!manual || !typing) return null;
                      return (
                        <div className="flex justify-end">
                          <div className="max-w-[86%] rounded-3xl bg-[#EBF57D] px-4 py-2 text-sm shadow-sm md:max-w-[72%]">
                            <div className="flex items-center gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-black/40" style={{ animationDelay: '0ms' }}></span>
                              <span className="h-2 w-2 animate-bounce rounded-full bg-black/40" style={{ animationDelay: '100ms' }}></span>
                              <span className="h-2 w-2 animate-bounce rounded-full bg-black/40" style={{ animationDelay: '200ms' }}></span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  }
                />
                {(() => {
                  const sel = conversations.find((x) => x.dify_conversation === selectedConvId);
                  return isEditableConversation(sel);
                })() && (
                  <div className="flex-shrink-0 border-t border-border/70 bg-background/70 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Digite sua mensagem"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          const isWaiting = !!selectedConvId && !!typingByConv[selectedConvId];
                          const lastRole = getLastMessageRoleForConversation(selectedConvId);
                          const isBlockedByLastMessage = lastRole === 'user';
                          if (e.key === 'Enter' && !sendingChat && !isWaiting && !isBlockedByLastMessage && chatInput.trim()) {
                            e.preventDefault();
                            sendManualMessage();
                          }
                        }}
                        disabled={(() => {
                          const isWaiting = !!selectedConvId && !!typingByConv[selectedConvId];
                          const lastRole = getLastMessageRoleForConversation(selectedConvId);
                          const isBlockedByLastMessage = lastRole === 'user';
                          return sendingChat || isWaiting || isBlockedByLastMessage;
                        })()}
                        className="h-10 flex-1 bg-background/80"
                      />
                      <Button
                        onClick={sendManualMessage}
                        disabled={(() => {
                          const isWaiting = !!selectedConvId && !!typingByConv[selectedConvId];
                          const lastRole = getLastMessageRoleForConversation(selectedConvId);
                          const isBlockedByLastMessage = lastRole === 'user';
                          return sendingChat || isWaiting || isBlockedByLastMessage || !chatInput.trim();
                        })()}
                        className="h-10 gap-2"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Enviar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fornecer Feedback</DialogTitle>
                  <DialogDescription>Por favor, explique o que deu errado na mensagem e como gostaria que fosse.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="feedback-text">Mensagem</Label>
                  <Textarea id="feedback-text" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Descreva seu feedback" />
                </div>
                <DialogFooter>
                  <Button onClick={sendFeedback} disabled={sendingFeedback}>
                    Enviar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Conversas;
