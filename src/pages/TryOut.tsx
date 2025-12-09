import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
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
            .from('tryout_feedback')
            .select('conversation_id,message_id,status')
            .eq('user_id', userIdForData)
            .in('conversation_id', convIds);
          if (Array.isArray(marks)) {
            const next: Record<string, 'up' | 'down'> = {};
            marks.forEach((m: any) => {
              if (m?.status === 'down' && typeof m?.message_id === 'string') {
                next[m.message_id] = 'down';
              }
              if (m?.status === 'up' && typeof m?.message_id === 'string') {
                next[m.message_id] = 'up';
              }
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

  const sendFeedback = async () => {
    if (!userIdForData) return;
    try {
      const idPath = String(userIdForData || '').replace(/-/g, '_');
      const url = 'https://primary-production-d442.up.railway.app/webhook/feedback-agente-otimizacao-autonomo';
      const profile = await getUserProfile(userIdForData);
      const conv = conversations.find((c) => c.dify_conversation === selectedConvId) || conversations[0];
      console.log('Debug Feedback URL:', url);
      console.log('Debug Feedback Body:', { message_id: feedbackMessageId, mensagem_feedback: feedbackText });
      const messageIdNormalized = normalizeMessageId(String(feedbackMessageId || ''));
      const form = new URLSearchParams({
        user_id: String(userIdForData || ''),
        message_id: messageIdNormalized,
        mensagem_feedback: String(feedbackText || ''),
        conversation_id: String(selectedConvId || conv?.dify_conversation || ''),
        dify_user: String(conv?.dify_user || ''),
        dify_conversation: String(conv?.dify_conversation || '')
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
      const res = await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });
      try {
        await supabase
          .from('tryout_feedback')
          .upsert({
            user_id: String(userIdForData || ''),
            conversation_id: String(selectedConvId || conv?.dify_conversation || ''),
            message_id: messageIdNormalized,
            status: 'down'
          });
      } catch {}
      setFeedback(String(feedbackMessageId || ''), 'down');
      toast({ title: 'Feedback enviado', description: 'Vamos analisar e revisar a IA.' });
      setFeedbackModalOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro de rede', description: e?.message || 'Não foi possível enviar o feedback.' });
    }
  };


  const selectedMessages = selectedConvId ? messagesByConv[selectedConvId] || [] : [];

  return (
    <div className="p-6">
      <Card className="border-border rounded-2xl shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={reloadMessages}>Recarregar Conversas</Button>
            <Button onClick={generateConversation}>Gerar Conversa</Button>
          </div>
          <div className="flex h-[85vh]">
            <div className="w-80 border-r border-border overflow-y-auto bg-muted/30">
              <div className="p-4 text-sm font-semibold">Conversas</div>
              <Separator />
              <div>
                {conversations.map((c) => {
                  const msgs = messagesByConv[c.dify_conversation] || [];
                  const last = msgs[msgs.length - 1];
                  const preview = (last?.content || last?.answer || '').toString();
                  const initials = typeof c.treinamento_id !== 'undefined' ? String(c.treinamento_id) : 'WL';
                  const title = typeof c.treinamento_id !== 'undefined' ? `Conversa ${c.treinamento_id}` : 'Conversa';
                  return (
                    <button
                      key={c.dify_conversation}
                      className={`w-full text-left px-3 py-3 hover:bg-muted transition-colors ${selectedConvId === c.dify_conversation ? 'bg-muted' : ''}`}
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
              <div className="p-4 space-y-3">
                {selectedMessages.length === 0 && (
                  <div className="text-sm text-muted-foreground">Nenhuma mensagem para esta conversa</div>
                )}
                {[...selectedMessages].sort((a,b)=>{
                  const ca = Number(a.created_at||0); const cb = Number(b.created_at||0);
                  return ca - cb;
                }).map((m, idx) => {
                  const isAssistant = m.role === 'assistant' || m.role === 'bot';
                  const text = (m.content || m.answer || '') as string;
                  return (
                    <div key={(m.id || idx).toString()} className="space-y-1">
                      <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${isAssistant ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'}`}>
                          {text}
                        </div>
                      </div>
                      {isAssistant && (
                        <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
                          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/60 px-1 py-0.5 shadow-sm">
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-5 w-5 p-0 transition-transform ${feedbackByMessage[normalizeMessageId(String(m.id || idx))] === 'up' ? 'scale-105' : ''}`}
                  onClick={() => setFeedback(String(m.id || idx), 'up')}
                >
                  <ThumbsUp className={`h-3 w-3 ${feedbackByMessage[normalizeMessageId(String(m.id || idx))] === 'up' ? 'text-green-600' : 'text-muted-foreground'}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={() => { setFeedback(String(m.id || idx), 'down'); setFeedbackMessageId(normalizeMessageId(String(m.id || idx))); setFeedbackText(''); setFeedbackModalOpen(true); }}
                >
                  <ThumbsDown className="h-3 w-3 text-muted-foreground" />
                </Button>
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
                <Button onClick={sendFeedback}>Enviar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
};

export default TryOut;
