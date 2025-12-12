import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ThumbsUp, ThumbsDown, RotateCcw, Sparkles } from 'lucide-react';
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

  const userIdForData = useMemo(() => {
    if (!user) return null;
    return user.id || null;
  }, [user]);

  useEffect(() => {
    const loadConversations = async () => {
      if (!userIdForData) return;
      setLoading(true);
      try {
        const supabaseUrl = (import.meta as any)?.env?.VITE_SUPABASE_URL || '';
        const supabaseAnon = (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY || '';
        const supabaseRestUrl = `${supabaseUrl}/rest/v1/leads_treinamento?select=dify_conversation,dify_user&user_id=eq.${userIdForData}`;
        const mask = (t: string) => (t ? `${t.slice(0,4)}...${t.slice(-4)}` : '<missing>');
        console.log('Debug Supabase REST:', supabaseRestUrl);
        console.log('Debug Supabase Headers:', { apikey: mask(supabaseAnon), Authorization: `Bearer ${mask(supabaseAnon)}` });
        console.log('Debug Supabase Query Params:', { table: 'leads_treinamento', select: 'dify_conversation,dify_user', filter: { user_id: userIdForData } });
        const { data: convs, error } = await supabase
          .from('leads_treinamento')
          .select('treinamento_id,dify_conversation,dify_user')
          .eq('user_id', userIdForData);
        console.log('Debug Supabase BY user_id result:', { error: !!error, rows: Array.isArray(convs) ? convs.length : 0, sample: Array.isArray(convs) && convs.length > 0 ? convs[0] : null });
        let filtered = (convs || []).filter((c: any) => typeof c?.dify_user === 'string' && c.dify_user.startsWith('worklivoo-')) as TrainingConversation[];
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
          setSelectedConvId(filtered[0].dify_conversation);
        }
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, [userIdForData]);

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

  const reloadMessages = async () => {
    if (!userIdForData) return;
    setLoading(true);
    try {
      const filtered = conversations;
      if (filtered.length === 0) return;
      let apiKey = (import.meta as any)?.env?.VITE_KNOWLEDGE_API_TOKEN || null;
      if (!apiKey) {
        const { data: keyRow } = await supabase
          .from('usuarios')
          .select('api_agente_dify')
          .eq('user_id', userIdForData)
          .single();
        apiKey = (keyRow as any)?.api_agente_dify || null;
      }
      if (!apiKey) {
        toast({ title: 'Configuração ausente', description: 'Chave da API não encontrada para o usuário.' });
        return;
      }
      const API_URL = 'https://api-production-42480.up.railway.app/v1';
      const fetchAll = await Promise.all(
        filtered.map(async (c) => {
          try {
            const res = await fetch(`${API_URL}/messages?conversation_id=${encodeURIComponent(c.dify_conversation)}&user=${encodeURIComponent(c.dify_user)}`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            });
            const json = await res.json();
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
            return { id: c.dify_conversation, items: expanded };
          } catch {
            return { id: c.dify_conversation, items: [] };
          }
        })
      );
      const map: Record<string, MessageItem[]> = {};
      fetchAll.forEach((r) => { map[r.id] = r.items; });
      setMessagesByConv(map);
      const cacheKey = `tryout:messages:${userIdForData}`;
      localStorage.setItem(cacheKey, JSON.stringify(map));

      try {
        const convIds = Object.keys(map);
        if (convIds.length > 0) {
          const { data: marks } = await supabase
            .from('feedbacks')
            .select('dify_conversation,mensagem_id,comentario_tipo')
            .eq('user_id', userIdForData)
            .in('dify_conversation', convIds);
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

  const generateConversation = async () => {
    if (!userIdForData) return;
    try {
      let apiKey = (import.meta as any)?.env?.VITE_KNOWLEDGE_API_TOKEN || null;
      if (!apiKey) {
        const { data: keyRow } = await supabase
          .from('usuarios')
          .select('api_agente_dify')
          .eq('user_id', userIdForData)
          .single();
        apiKey = (keyRow as any)?.api_agente_dify || null;
      }
      if (!apiKey) {
        toast({ title: 'Configuração ausente', description: 'Chave da API do agente Dify não encontrada.' });
        return;
      }
      const url = 'https://primary-production-d442.up.railway.app/webhook/treinamento-agente-treinamento-carro';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_agente_dify: apiKey, user_id: userIdForData })
      });
      if (res.ok) {
        toast({ title: 'Conversa Gerada', description: 'Aguarde 5 minutos para a conversa aparecer.' });
      } else {
        const text = await res.text();
        toast({ title: 'Falha ao Gerar', description: text || `Status ${res.status}` });
      }
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível gerar a conversa.' });
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
      const idempotencyKey = `${String(userIdForData || '')}:${messageIdNormalized}:negativo`;
      const form = new URLSearchParams({
        user_id: String(userIdForData || ''),
        message_id: messageIdNormalized,
        mensagem_feedback: String(feedbackText || ''),
        conversation_id: String(selectedConvId || conv?.dify_conversation || ''),
        dify_user: String(conv?.dify_user || ''),
        dify_conversation: String(conv?.dify_conversation || ''),
        idempotency_key: idempotencyKey
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
      try {
        await supabase
          .from('feedbacks')
          .insert({
            user_id: String(userIdForData || ''),
            mensagem_id: messageIdNormalized,
            comentario_tipo: 'negativo',
            comentario_mensagem: String(feedbackText || ''),
            dify_conversation: String(selectedConvId || conv?.dify_conversation || ''),
            dify_user: String(conv?.dify_user || '')
          });
      } catch {}
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
      const title = typeof c.treinamento_id !== 'undefined' ? `Conversa ${c.treinamento_id}` : 'Conversa';
      return title.toLowerCase().includes(term) || preview.includes(term);
    });
  }, [orderedConversations, messagesByConv, search]);

  return (
    <div className="p-6 bg-gradient-to-b from-background to-muted/40">
      <Card className="border-border rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-lg font-semibold tracking-tight">TryOut</div>
              <div className="text-xs text-muted-foreground">Ambiente de testes do agente</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={reloadMessages} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Recarregar
              </Button>
              <Button onClick={generateConversation} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Gerar Conversa
              </Button>
            </div>
          </div>
          <div className="flex h-[85vh]">
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
                  const initials = typeof c.treinamento_id !== 'undefined' ? String(c.treinamento_id) : 'WL';
                  const title = typeof c.treinamento_id !== 'undefined' ? `Conversa ${c.treinamento_id}` : 'Conversa';
                  return (
                    <button
                      key={c.dify_conversation}
                      className={`w-full text-left px-3 py-3 mx-2 my-1 rounded-xl transition-colors ${selectedConvId === c.dify_conversation ? 'bg-muted ring-1 ring-primary/30' : 'hover:bg-muted/60'}`}
                      onClick={() => setSelectedConvId(c.dify_conversation)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate max-w-[9rem]">{title}</div>
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
            <div className="flex-1 overflow-y-auto bg-background">
              <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-4 py-3 flex items-center gap-3">
                  {selectedConvId && (
                    <>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{(() => { const sel = conversations.find((x)=>x.dify_conversation===selectedConvId); return (sel && typeof sel.treinamento_id !== 'undefined') ? String(sel.treinamento_id) : 'WL' })()}</AvatarFallback>
                      </Avatar>
                      <div className="text-sm font-semibold truncate">{(() => { const sel = conversations.find((x)=>x.dify_conversation===selectedConvId); return (sel && typeof sel.treinamento_id !== 'undefined') ? `Conversa ${sel.treinamento_id}` : 'Conversa'; })()}</div>
                    </>
                  )}
                  {!selectedConvId && <div className="text-sm font-semibold">Conversas</div>}
                </div>
              </div>
              <div className="p-4 space-y-4">
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
                        <div className={`max-w-[70%] rounded-3xl px-3 py-2 text-sm shadow ${isAssistant ? 'bg-muted/60 backdrop-blur ring-1 ring-border text-foreground' : 'bg-primary/90 text-primary-foreground'}`}>
                          {text}
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
              </div>
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
