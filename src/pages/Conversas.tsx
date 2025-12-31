import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ThumbsUp, ThumbsDown, RotateCcw, MessageCircle, Smartphone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { getUserProfile } from '@/lib/supabase-utils';
import { useToast } from '@/hooks/use-toast';

type TrainingConversation = {
  treinamento_id?: number
  dify_conversation: string
  dify_user: string
  user_id: string
}

type MessageItem = {
  id?: string
  content?: string
  answer?: string
  role?: string
  created_at?: string
}

const TryOut = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<TrainingConversation[]>([]);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, MessageItem[]>>({});
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [feedbackByMessage, setFeedbackByMessage] = useState<Record<string, 'up' | 'down'>>({});
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [search, setSearch] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [typingByConv, setTypingByConv] = useState<Record<string, boolean>>({});
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const scrollMessagesToBottom = () => {
    const el = messagesRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
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

  useEffect(() => {
    const loadConversations = async () => {
      if (!userIdForData) return;
      setLoading(true);
      try {
        const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL || '';
        const supabaseAnon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '';
        const supabaseRestUrl = `${supabaseUrl}/rest/v1/leads?select=thread_dify,lead_telefone,user_id&user_id=eq.${userIdForData}`;
        const mask = (t: string) => (t ? `${t.slice(0,4)}...${t.slice(-4)}` : '<missing>');
        console.log('Debug Supabase REST:', supabaseRestUrl);
        console.log('Debug Supabase Headers:', { apikey: mask(supabaseAnon), Authorization: `Bearer ${mask(supabaseAnon)}` });
        console.log('Debug Supabase Query Params:', { table: 'leads', select: 'thread_dify,lead_telefone,user_id', filter: { user_id: userIdForData } });

        const pageSize = 1000;
        let from = 0;
        let to = pageSize - 1;
        const allRows: any[] = [];
        while (true) {
          const { data: rows, error } = await supabase
            .from('leads')
            .select('thread_dify,lead_telefone,user_id')
            .eq('user_id', userIdForData)
            .not('thread_dify', 'is', null)
            .not('lead_telefone', 'is', null)
            .neq('thread_dify', '')
            .neq('lead_telefone', '')
            .range(from, to);
          if (error) {
            console.warn('Debug Supabase error:', error);
            break;
          }
          const batch = rows || [];
          allRows.push(...batch);
          if (batch.length < pageSize) break;
          from += pageSize;
          to += pageSize;
        }
        console.log('Debug Supabase BY user_id result (leads):', { rows: allRows.length, sample: allRows.length > 0 ? allRows[0] : null });

        const filtered = allRows
          .filter((r) => typeof r?.thread_dify === 'string' && r.thread_dify.trim() !== '')
          .map((r) => ({ dify_conversation: String(r.thread_dify), dify_user: String(r.lead_telefone), user_id: String(r.user_id) })) as TrainingConversation[];
        setConversations(filtered);
        console.log('Debug: conversations filtered count:', filtered.length);
        if (filtered.length > 0) {
          console.log('Debug: first filtered conversation:', filtered[0]);
        }
        if (filtered.length === 0) {
          setSelectedConvId(null);
          setMessagesByConv({});
          setLoading(false);
          console.warn('Debug: no conversations found for user_id, stopping.');
          return;
        }
        const cacheKey = `tryout:messages:${userIdForData}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object') {
              setMessagesByConv(parsed);
            }
          } catch {}
        }
        if (filtered.length > 0) {
          const kSel = `tryout:selectedConv:${userIdForData}`;
          let saved: string | null = null;
          try { saved = localStorage.getItem(kSel); } catch {}
          const candidate = saved || selectedConvId;
          const exists = !!candidate && filtered.some((c) => c.dify_conversation === candidate);
          setSelectedConvId(exists ? String(candidate) : filtered[0].dify_conversation);
        }
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [userIdForData]);

  useEffect(() => {
    const main = document.querySelector('.main-content') as HTMLElement | null;
    if (!main) return;
    const prev = {
      paddingTop: main.style.paddingTop,
      paddingBottom: main.style.paddingBottom,
      height: main.style.height,
      overflow: main.style.overflow,
    };
    main.style.paddingTop = '0';
    main.style.paddingBottom = '0';
    main.style.height = '100vh';
    main.style.overflow = 'hidden';
    return () => {
      main.style.paddingTop = prev.paddingTop;
      main.style.paddingBottom = prev.paddingBottom;
      main.style.height = prev.height;
      main.style.overflow = prev.overflow;
    };
  }, []);

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

  const reloadMessages = async () => {
    if (!userIdForData) return;
    if (loading) return;
    setLoading(true);
    try {
      console.log('Debug reloadMessages start:', { userIdForData, selectedConvId, conversationsCount: conversations.length });
      const filtered = conversations;
      if (filtered.length === 0) return;
      const { data: keyRow } = await supabase
        .from('usuarios')
        .select('api_agente_dify')
        .eq('user_id', userIdForData)
        .single();
      console.log('Debug reloadMessages keyRow:', keyRow);
      let apiKey = (keyRow as any)?.api_agente_dify || null;
      console.log('Debug reloadMessages apiKey present:', !!apiKey);
      if (!apiKey) {
        const selConv = selectedConvId ? filtered.find((c) => c.dify_conversation === selectedConvId) : null;
        const fallbackUserId = selConv?.user_id || filtered[0]?.user_id;
        if (fallbackUserId) {
          const { data: altKeyRow } = await supabase
            .from('usuarios')
            .select('api_agente_dify')
            .eq('user_id', fallbackUserId)
            .single();
          apiKey = (altKeyRow as any)?.api_agente_dify || null;
          console.log('Debug reloadMessages fallback apiKey present:', !!apiKey, 'fallbackUserId:', fallbackUserId);
        }
      }
      if (!apiKey) {
        const MAX_FETCH_CONVERSATIONS = 50;
        const baseList = filtered.slice(0, MAX_FETCH_CONVERSATIONS);
        const selConv = selectedConvId ? filtered.find((c) => c.dify_conversation === selectedConvId) : null;
        const convList = selConv && !baseList.some((c) => c.dify_conversation === selConv.dify_conversation)
          ? [selConv, ...baseList]
          : baseList;
        console.log('Debug reloadMessages without apiKey:', { MAX_FETCH_CONVERSATIONS, convListCount: convList.length });
        const map: Record<string, MessageItem[]> = {};
        convList.forEach((c) => { map[c.dify_conversation] = messagesByConv[c.dify_conversation] || []; });
        setMessagesByConv(map);
        const cacheKey = `tryout:messages:${userIdForData}`;
        localStorage.setItem(cacheKey, JSON.stringify(map));
        toast({ title: 'Conversas atualizadas', description: 'Mensagens não carregadas: chave de API ausente.' });
        if (!selectedConvId && filtered.length > 0) setSelectedConvId(filtered[0].dify_conversation);
        return;
      }
      const API_URL = 'https://api-production-42480.up.railway.app/v1';
      const MAX_FETCH_CONVERSATIONS = 50;
      const baseList = filtered.slice(0, MAX_FETCH_CONVERSATIONS);
      const selConv = selectedConvId ? filtered.find((c) => c.dify_conversation === selectedConvId) : null;
      const convList = selConv && !baseList.some((c) => c.dify_conversation === selConv.dify_conversation)
        ? [selConv, ...baseList]
        : baseList;
      console.log('Debug reloadMessages params:', { API_URL, MAX_FETCH_CONVERSATIONS, convListCount: convList.length, selectedConvId });

      const parallelMap = async <T, R>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<R>): Promise<R[]> => {
        const results: R[] = new Array(items.length) as any;
        let index = 0;
        const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
          while (true) {
            const i = index++;
            if (i >= items.length) break;
            results[i] = await fn(items[i], i);
          }
        });
        await Promise.all(workers);
        return results;
      };

      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const fetchAll = await parallelMap(convList, 4, async (c) => {
        try {
          const url = `${API_URL}/messages?conversation_id=${encodeURIComponent(c.dify_conversation)}&user=${encodeURIComponent(c.dify_user)}`;
          console.log('Dify GET /messages payload:', { url, headers: { Authorization: `Bearer ${mask(apiKey)}` } });
          let lastErrorText = '';
          let json: any = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
            if (res.ok) {
              try {
                json = await res.json();
              } catch (e: any) {
                lastErrorText = e?.message || 'json parse error';
                json = null;
              }
              if (json != null) break;
            } else {
              try {
                lastErrorText = await res.text();
              } catch {}
              console.warn('Dify GET /messages failed:', { conversation_id: c.dify_conversation, status: res.status, error: lastErrorText });
            }
            const backoff = 250 * Math.pow(2, attempt);
            await sleep(backoff);
          }
          if (json == null) {
            console.warn('Dify GET /messages no data after retries:', { conversation_id: c.dify_conversation, user: c.dify_user, error: lastErrorText });
            return { id: c.dify_conversation, items: [] };
          }
          const raw: any[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
          const expanded: MessageItem[] = [];
          raw.forEach((it: any, idx: number) => {
            const createdAt = it?.created_at ? String(it.created_at) : undefined;
            if (typeof it?.query === 'string' && it.query.trim() !== '') {
              expanded.push({ id: `${it?.id || idx}-q`, role: 'user', content: it.query, created_at: createdAt });
            }
            if (typeof it?.answer === 'string' && it.answer.trim() !== '') {
              expanded.push({ id: `${it?.id || idx}-a`, role: 'assistant', content: it.answer, created_at: createdAt });
            }
          });
          console.log('Debug fetch messages response:', { conversation_id: c.dify_conversation, items: expanded.length });
          return { id: c.dify_conversation, items: expanded };
        } catch (e: any) {
          console.warn('Dify GET /messages network error:', { conversation_id: c.dify_conversation, user: c.dify_user, error: e?.message || 'unknown' });
          return { id: c.dify_conversation, items: [] };
        }
      });
      const map: Record<string, MessageItem[]> = {};
      fetchAll.forEach((r) => { map[r.id] = r.items; });
      console.log('Debug messages map size:', Object.keys(map).length);
      setMessagesByConv(map);
      const cacheKey = `tryout:messages:${userIdForData}`;
      localStorage.setItem(cacheKey, JSON.stringify(map));

      try {
        const convIds = Object.keys(map);
        console.log('Debug fetch feedback marks params:', { user_id: userIdForData, convIdsCount: convIds.length });
        if (convIds.length > 0) {
          const { data: marks } = await supabase
            .from('feedbacks')
            .select('dify_conversation,mensagem_id,comentario_tipo')
            .eq('user_id', userIdForData)
            .in('dify_conversation', convIds);
          console.log('Debug feedback marks count:', Array.isArray(marks) ? marks.length : 0);
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
        }
      } catch {}
      toast({ title: 'Conversas atualizadas', description: 'Mensagens recarregadas com sucesso.' });
      if (!selectedConvId && filtered.length > 0) setSelectedConvId(filtered[0].dify_conversation);
    } finally {
      setLoading(false);
    }
  };

  const normalizeMessageId = (id: string) => {
    if (!id) return id;
    if (id.endsWith('-q') || id.endsWith('-a')) return id.slice(0, -2);
    return id;
  };

  const formatMessage = (s: string) => {
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
    const renderWithLinks = (text: string, keyPrefix: string) => {
      const out: (string | JSX.Element)[] = [];
      let last = 0;
      let i = 0;
      let m: RegExpExecArray | null;
      while ((m = urlRegex.exec(text)) !== null) {
        const start = m.index;
        const end = urlRegex.lastIndex;
        if (start > last) out.push(text.slice(last, start));
        const raw = m[0];
        const href = raw.startsWith('http') ? raw : `https://${raw}`;
        out.push(
          <a
            key={`${keyPrefix}-lnk-${i}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline opacity-90 hover:opacity-100 break-all"
          >
            {raw}
          </a>
        );
        last = end;
        i++;
      }
      if (last < text.length) out.push(text.slice(last));
      return out;
    };

    const pieces: (string | JSX.Element)[] = [];
    const boldRegex = /\*(.+?)\*/g;
    let lastIndex = 0;
    let idx = 0;
    let m: RegExpExecArray | null;
    while ((m = boldRegex.exec(s)) !== null) {
      const start = m.index;
      const end = boldRegex.lastIndex;
      if (start > lastIndex) pieces.push(...renderWithLinks(s.slice(lastIndex, start), `pre-${idx}`));
      pieces.push(
        <span key={`fmt-${idx}`} className="font-semibold opacity-90">
          {renderWithLinks(m[1], `bold-${idx}`)}
        </span>
      );
      lastIndex = end;
      idx++;
    }
    if (lastIndex < s.length) pieces.push(...renderWithLinks(s.slice(lastIndex), `post-${idx}`));
    return pieces;
  };


  const sendManualMessage = async () => {
    if (!userIdForData) return;
    if (!selectedConvId) return;
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput('');
    setSendingChat(true);
    try {
      const { data: keyRow } = await supabase
        .from('usuarios')
        .select('api_agente_dify')
        .eq('user_id', userIdForData)
        .single();
      const apiKey = (keyRow as any)?.api_agente_dify || null;
      if (!apiKey) {
        toast({ title: 'Configuração ausente', description: 'Chave da API do agente Dify não encontrada.' });
        return;
      }
      const conv = conversations.find((c) => c.dify_conversation === selectedConvId);
      if (!conv) {
        toast({ title: 'Conversa inválida', description: 'Seleção de conversa não encontrada.' });
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
        const cacheKey = `tryout:messages:${userIdForData}`;
        try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch {}
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
          if (!messageAnswer && ev?.event === 'agent_thought' && typeof ev?.thought === 'string') messageAnswer = ev.thought;
        });
        const assistantMsg: MessageItem = { id: `${Date.now()}-a`, role: 'assistant', content: messageAnswer, created_at: String(createdAt) };
        setMessagesByConv((prev) => {
          const next = { ...prev };
          const arr = next[conv.dify_conversation] ? [...next[conv.dify_conversation]] : [];
          arr.push(assistantMsg);
          next[conv.dify_conversation] = arr;
          const cacheKey = `tryout:messages:${userIdForData}`;
          try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch {}
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
    const conv = conversations.find((c) => c.dify_conversation === selectedConvId) || conversations[0];
    const messageIdNormalized = normalizeMessageId(String(messageId || ''));
    try {
      await supabase
        .from('feedbacks')
        .insert({
          user_id: String(userIdForData || ''),
          mensagem_id: messageIdNormalized,
          comentario_tipo: 'positivo',
          comentario_mensagem: null,
          dify_conversation: String(selectedConvId || conv?.dify_conversation || ''),
          dify_user: String(conv?.dify_user || '')
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
      const url = 'https://primary-production-d442.up.railway.app/webhook/feedback-agente-otimizacao-autonomo';
      const profile = await getUserProfile(userIdForData);
      const conv = conversations.find((c) => c.dify_conversation === selectedConvId) || conversations[0];
      const messageIdNormalized = normalizeMessageId(String(feedbackMessageId || ''));
      
      // 1. Criar registro no Supabase primeiro
      let createdFeedbackId = '';
      try {
        const { data: insertedFeedback, error: dbError } = await supabase
          .from('feedbacks')
          .insert({
            user_id: String(userIdForData || ''),
            mensagem_id: messageIdNormalized,
            comentario_tipo: 'negativo',
            comentario_mensagem: String(feedbackText || ''),
            dify_conversation: String(selectedConvId || conv?.dify_conversation || ''),
            dify_user: String(conv?.dify_user || '')
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
      const form = new URLSearchParams({
        user_id: String(userIdForData || ''),
        message_id: messageIdNormalized,
        mensagem_feedback: String(feedbackText || ''),
        conversation_id: String(selectedConvId || conv?.dify_conversation || ''),
        dify_user: String(conv?.dify_user || ''),
        dify_conversation: String(conv?.dify_conversation || ''),
        idempotency_key: idempotencyKey,
        feedback_id: createdFeedbackId // Campo adicionado
      });

      if (profile && typeof profile === 'object') {
        Object.entries(profile as any).forEach(([k, v]) => {
          try {
            const key = String(k);
            const val = v == null ? '' : String(v);
            form.append(key, val);
          } catch {}
        });
      }

      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
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
      const am = messagesByConv[a.dify_conversation] || [];
      const bm = messagesByConv[b.dify_conversation] || [];
      const al = am.reduce((mx, m) => { const t = Number(m.created_at || 0); return t > mx ? t : mx; }, 0);
      const bl = bm.reduce((mx, m) => { const t = Number(m.created_at || 0); return t > mx ? t : mx; }, 0);
      return bl - al;
    });
  }, [conversations, messagesByConv]);
  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return orderedConversations;
    return orderedConversations.filter((c) => {
      const msgs = messagesByConv[c.dify_conversation] || [];
      const last = msgs[msgs.length - 1];
      const preview = (last?.content || last?.answer || '').toString().toLowerCase();
      const phoneTitle = formatPhone(c.dify_user || '');
      return phoneTitle.toLowerCase().includes(term) || preview.includes(term);
    });
  }, [orderedConversations, messagesByConv, search]);

  return (
    <div className="h-[100vh] overflow-hidden bg-gradient-to-b from-background to-muted/40 py-4">
      <Card className="border-border rounded-2xl shadow-sm h-full overflow-hidden">
        <CardContent className="p-0 h-full flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-lg font-semibold tracking-tight">Conversas</div>
              <div className="text-xs text-muted-foreground">Conversas da IA</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reloadMessages} disabled={loading} className="gap-2 hover:!bg-[#EBF57D]">
                <RotateCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Carregando' : 'Recarregar'}
              </Button>
              
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="w-80 border-r border-border overflow-y-auto overflow-x-hidden bg-muted/30">
              <div className="p-4">
                <div className="text-sm font-semibold mb-2">Conversas</div>
                <Input
                  placeholder="Buscar conversa"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
                
              </div>
              <Separator />
              <div>
                {filteredConversations.map((c) => {
                  const msgs = messagesByConv[c.dify_conversation] || [];
                  const last = msgs[msgs.length - 1];
                  const preview = (last?.content || last?.answer || '').toString();
                  const title = formatPhone(c.dify_user || '');
                  const isManual = typeof c.dify_user === 'string' && c.dify_user.startsWith('worklivoo-manual-');
                  return (
                    <button
                      key={c.dify_conversation}
                      className={`w-full text-left px-2 py-3 mx-0 my-1 rounded-xl transition-colors ${selectedConvId === c.dify_conversation ? (isManual ? 'bg-[#EBF57D] ring-1 ring-primary/30' : 'bg-muted ring-1 ring-primary/30') : (isManual ? 'bg-[#EBF57D]/25 hover:bg-[#EBF57D]' : 'hover:bg-muted/60')}`}
                      onClick={() => setSelectedConvId(c.dify_conversation)}
                    >
                      <div className="flex items-center gap-1">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            <Smartphone className="h-4 w-4" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{preview}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
                {loading && (
                  <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
                )}
                {!loading && conversations.length === 0 && (
                  <div className="p-3 text-sm text-muted-foreground">Nenhuma conversa disponível</div>
                )}
              </div>
            </div>
            <div className="flex-1 bg-background flex flex-col overflow-hidden">
              <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                        <div className="px-4 py-3 flex items-center gap-3">
                          {selectedConvId && (
                            <>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>
                                  <Smartphone className="h-4 w-4" />
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-sm font-semibold truncate">{(() => { const sel = conversations.find((x)=>x.dify_conversation===selectedConvId); return formatPhone(sel?.dify_user || ''); })()}</div>
                            </>
                          )}
                          {!selectedConvId && <div className="text-sm font-semibold">Conversas</div>}
                        </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={messagesRef}>
                {selectedMessages.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhuma mensagem para esta conversa</div>
                )}
                {[...selectedMessages].sort((a,b)=>{
                  const ca = Number(a.created_at||0); const cb = Number(b.created_at||0);
                  return ca - cb;
                }).map((m, idx) => {
                  const isAssistant = m.role === 'assistant' || m.role === 'bot';
                  const text = (m.content || m.answer || '') as string;
                  const baseId = normalizeMessageId(String(m.id || idx));
                  return (
                    <div key={(m.id || idx).toString()} className="space-y-1">
                      <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] rounded-3xl px-3 py-2 text-sm shadow whitespace-pre-line ${isAssistant ? 'bg-muted/60 backdrop-blur ring-1 ring-border text-foreground' : 'bg-primary/90 text-primary-foreground'}`}>
                          {formatMessage(text)}
                        </div>
                      </div>
                      {isAssistant && (
                        <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                          <div className="inline-flex items-center gap-1 rounded-full ring-1 ring-border bg-background/80 px-1 py-0.5 shadow">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className={`h-6 w-6 p-0 transition-transform ${feedbackByMessage[baseId] === 'up' ? 'scale-105' : ''}`}
                                    onClick={() => sendPositive(String(m.id || idx))}
                                  >
                                    <ThumbsUp className={`h-3.5 w-3.5 ${feedbackByMessage[baseId] === 'up' ? 'text-green-600' : 'text-muted-foreground'}`} />
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
                                    onClick={() => { setFeedback(String(m.id || idx), 'down'); setFeedbackMessageId(String(m.id || idx)); setFeedbackText(''); setFeedbackModalOpen(true); }}
                                  >
                                    <ThumbsDown className={`h-3.5 w-3.5 ${feedbackByMessage[baseId] === 'down' ? 'text-red-600' : 'text-muted-foreground'}`} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Não gostei</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(() => { const sel = conversations.find((x)=>x.dify_conversation===selectedConvId); const manual = !!sel && typeof sel.dify_user === 'string' && sel.dify_user.startsWith('worklivoo-manual-'); const typing = !!selectedConvId && typingByConv[selectedConvId]; return manual && typing; })() && (
                  <div className="flex justify-start">
                    <div className="max-w-[70%] rounded-3xl px-3 py-2 text-sm shadow bg-muted/60 backdrop-blur ring-1 ring-border text-foreground">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '100ms' }}></span>
                        <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '200ms' }}></span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {(() => { const sel = conversations.find((x)=>x.dify_conversation===selectedConvId); const manual = !!sel && typeof sel.dify_user === 'string' && sel.dify_user.startsWith('worklivoo-manual-'); return manual; })() && (
                <div className="border-t border-border bg-background px-4 py-3 flex items-center gap-2">
                  <Input
                    placeholder="Digite sua mensagem"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sendingChat && chatInput.trim()) { e.preventDefault(); sendManualMessage(); } }}
                    className="flex-1 h-9"
                  />
                  <Button onClick={sendManualMessage} disabled={sendingChat || !chatInput.trim()} className="gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Enviar
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Dialog open={feedbackModalOpen} onOpenChange={setFeedbackModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fornecer Feedback</DialogTitle>
                <DialogDescription>
                  Por favor, explique o que deu errado na mensagem e como gostaria que fosse.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                <Label htmlFor="feedback-text">Mensagem</Label>
                <Textarea id="feedback-text" value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Descreva seu feedback" />
              </div>
              <DialogFooter>
                <Button onClick={sendFeedback} disabled={sendingFeedback}>Enviar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default TryOut;
