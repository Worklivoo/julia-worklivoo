import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BookOpen, FileText, Layers, Plus, Folder, Pencil, Sparkles, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/contexts/CRMContext';
import { getBaseConhecimentoByUser, updateBaseConhecimentoByUser, createBaseConhecimentoForUser } from '@/lib/supabase-utils';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

const BaseDeConhecimento = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [base, setBase] = useState<any | null>(null);
  const [openConhecimento, setOpenConhecimento] = useState(false);
  const [openDocumento, setOpenDocumento] = useState(false);
  const [conhecimentoInput, setConhecimentoInput] = useState('');
  const [documentoInput, setDocumentoInput] = useState('');
  const conhecimentoCount = useMemo(() => (base?.conhecimento_id ? 1 : 0), [base]);
  const documentoCount = useMemo(() => (base?.documento_id ? 1 : 0), [base]);
  const knowledgeName = useMemo(() => {
    const empresa = (user?.empresa || '').trim();
    return empresa ? `${empresa} (Conhecimento)` : `Empresa (Conhecimento)`;
  }, [user?.empresa]);
  const documentName = useMemo(() => {
    const empresa = (user?.empresa || '').trim();
    return empresa ? `${empresa} (Documento)` : `Empresa (Documento)`;
  }, [user?.empresa]);
  const [knowledgeInfo, setKnowledgeInfo] = useState<any | null>(null);
  const [docInfo, setDocInfo] = useState<any | null>(null);
  const [fragments, setFragments] = useState<any[]>([]);
  const [fragPergunta, setFragPergunta] = useState('');
  const [fragResposta, setFragResposta] = useState('');
  const [openFragment, setOpenFragment] = useState(false);
  const [newFragPergunta, setNewFragPergunta] = useState('');
  const [newFragResposta, setNewFragResposta] = useState('');
  const [openEditFragment, setOpenEditFragment] = useState(false);
  const [editFragPergunta, setEditFragPergunta] = useState('');
  const [editFragResposta, setEditFragResposta] = useState('');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [aiSuggestions, setAISuggestions] = useState<string[]>([]);
  const [openAISuggestions, setOpenAISuggestions] = useState(false);
  const [openAcceptFragment, setOpenAcceptFragment] = useState(false);
  const [acceptIndex, setAcceptIndex] = useState<number | null>(null);
  const [acceptQuestion, setAcceptQuestion] = useState('');
  const [acceptAnswer, setAcceptAnswer] = useState('');
  const [rejected, setRejected] = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      const { data } = await getBaseConhecimentoByUser(user.id);
      setBase(data);
      setLoading(false);
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    const fetchKnowledge = async () => {
      if (!base?.conhecimento_id) return;
      const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
      const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
      if (!API_TOKEN) return;
      try {
        const res = await fetch(`${API_URL}/datasets/${base.conhecimento_id}`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
        const json = await res.json();
        setKnowledgeInfo(json?.data ?? json);
      } catch {}
    };
    fetchKnowledge();
  }, [base?.conhecimento_id]);

  useEffect(() => {
    const fetchDocumentDetails = async () => {
      if (!base?.conhecimento_id || !base?.documento_id) return;
      const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
      const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
      if (!API_TOKEN) return;
      try {
        const res = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}?metadata=all`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
        const json = await res.json();
        setDocInfo(json?.data ?? json);
      } catch {}
      try {
        const segRes = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments?page=1&limit=20`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
        const segJson = await segRes.json();
        const items = Array.isArray(segJson) ? segJson : (Array.isArray(segJson?.data) ? segJson.data : []);
        setFragments(items);
      } catch {}
    };
    fetchDocumentDetails();
  }, [base?.conhecimento_id, base?.documento_id]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Base de Conhecimento</h1>
          <p className="text-sm text-muted-foreground">Nessa página você deve inserir todas as perguntas e respostas que você gostaria que a IA seguisse no atendimento aos leads.</p>
          <p className="text-sm font-semibold text-foreground mt-1">Observação: Coloque apenas o necessário!</p>
        </div>
      </div>

      <Separator className="my-2" />

      <div className="grid grid-cols-1 gap-6">
        
        <div className="grid grid-cols-2 gap-6">
        <Card className={`border-border bg-card ${base?.conhecimento_id ? '' : 'col-span-2'}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <BookOpen className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Conhecimento</CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">{conhecimentoCount}/1</Badge>
              {conhecimentoCount < 1 && (
                <Button disabled={loading} onClick={() => setOpenConhecimento(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Conhecimento
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {base?.conhecimento_id ? (
              <div className="rounded-xl p-4 bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Folder className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{knowledgeInfo?.name || knowledgeInfo?.dataset_name || knowledgeName}</p>
                    <p className="text-xs text-muted-foreground">ID: {base.conhecimento_id}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-6 bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Começe criando o seu primeiro conhecimento.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {base?.conhecimento_id && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <FileText className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Documento</CardTitle>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">{documentoCount}/1</Badge>
              {documentoCount < 1 && (
                <Button disabled={loading || !base?.conhecimento_id} onClick={() => setOpenDocumento(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Documento
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {base?.documento_id ? (
              <div className="rounded-xl p-4 bg-muted/30 border border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Folder className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{documentName}</p>
                    <p className="text-xs text-muted-foreground">ID: {base.documento_id}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-6 bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Crie o primeiro documento para inserir as perguntas.</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}
        </div>

        {base?.documento_id && (
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <Layers className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl">Perguntas & Respostas</CardTitle>
                <CardDescription>Adicione aqui todas as perguntas e respostas para IA conseguir melhorar o atendimento</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="rounded-full">{fragments.length}</Badge>
              <Button disabled={loading || !base?.conhecimento_id || !base?.documento_id} onClick={() => setOpenFragment(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Pergunta
              </Button>
              <Button variant="outline" className="hover:bg-[#EBF57D]" disabled={loading || !base?.documento_id} onClick={async () => {
                if (!user || !base?.documento_id) return;
                const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY;
                if (!OPENAI_KEY) {
                  toast({ title: 'Configuração ausente', description: 'Chave da OpenAI não configurada.' });
                  return;
                }
                setLoading(true);
                try {
                  const contextoPrompt = base?.prompt || '';
                  const contextoFragments = fragments.map((f) => {
                    const t = f?.content || f?.text || '';
                    return t;
                  }).join('\n');
                  const userContent = `Gere 5 perguntas e respostas sobre atendimento comercial em empresas do setor industrial.\n\nPROMPT:\n${contextoPrompt}\n\nCONTEUDO ATUAL:\n${contextoFragments}`;
                  const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
                    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [ { role: 'system', content: `Você é um gerador inteligente de perguntas que um lead pode ter durante um atendimento no WhatsApp.\n\nSiga todas as regras abaixo com rigor máximo:\n\n1. Use APENAS as informações fornecidas no contexto (PROMPT do agente + Perguntas e Respostas já existentes). Nunca invente políticas, promessas, garantias, preços ou informações que não estejam no contexto.\n2. Gere ATÉ 5 novas perguntas relevantes que um lead provavelmente faria.\n3. As perguntas criadas DEVEM complementar o conteúdo do contexto, nunca repetir, reescrever ou reformular informações que JÁ estão no PROMPT ou nas Perguntas e Respostas existentes.\n4. As perguntas devem ser objetivas, naturais e baseadas na necessidade real de um lead.\n5. O retorno deve ser EXCLUSIVAMENTE neste formato, sem texto antes, depois ou explicações:\n   \n1. Pergunta 1\n2. Pergunta 2\n3. Pergunta 3\n4. Pergunta 4\n5. Pergunta 5\n\n6. Caso não existam perguntas novas possíveis sem repetição, retorne apenas:\n\n1. —\n2. —\n3. —\n4. —\n5. —` }, { role: 'user', content: userContent } ] })
                  });
                  const json = await res.json();
                  const content = json?.choices?.[0]?.message?.content || '';
                  const lines = content.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
                  setAISuggestions(lines);
                  setRejected([]);
                  setOpenAISuggestions(true);
                  toast({ title: 'Perguntas geradas', description: 'A IA sugeriu novas perguntas.' });
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a OpenAI.' });
                } finally {
                  setLoading(false);
                }
              }}>
                <Sparkles className="w-4 h-4 mr-2" />
                Gerar Perguntas com IA
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fragments.length > 0 ? (
              <div className="space-y-3">
                {fragments.map((frag, idx) => {
                  const text = frag?.content || frag?.text || '';
                  const qMatch = /Pergunta:\s*(.*)/i.exec(text);
                  const aMatch = /Resposta:\s*(.*)/i.exec(text);
                  let pergunta = '';
                  let resposta = '';
                  if (qMatch && aMatch) {
                    pergunta = qMatch[1];
                    resposta = aMatch[1];
                  } else {
                    const parts = text.split(/\r?\n\r?\n/);
                    pergunta = (parts[0] || text).trim();
                    resposta = (parts[1] || '').trim();
                  }
                  const segId = frag?.id || frag?.segment_id || '';
                  return (
                    <div key={idx} className="rounded-xl p-4 bg-muted/30 border border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="text-sm text-foreground font-medium">{pergunta}</div>
                          {resposta && <div className="text-xs text-muted-foreground mt-1">{resposta}</div>}
                        </div>
                        <Button variant="ghost" size="sm" className="hover:bg-[#EBF57D]" disabled={!base?.conhecimento_id || !base?.documento_id || !segId} onClick={() => {
                          setEditingSegmentId(segId || null);
                          setEditFragPergunta(pergunta);
                          setEditFragResposta(resposta);
                          setOpenEditFragment(true);
                        }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Switch
                          className="self-center data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-muted"
                          checked={!!frag?.enabled}
                          onCheckedChange={async (checked) => {
                            if (!user || !base?.conhecimento_id || !base?.documento_id || !segId) return;
                            const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                            const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                            if (!API_TOKEN) {
                              toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                              return;
                            }
                            try {
                              const res = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments/${segId}`, {
                                method: 'POST',
                                headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ segment: { enabled: checked } })
                              });
                              if (!res.ok) {
                                toast({ title: 'Erro ao atualizar status', description: `Código: ${res.status}` });
                              } else {
                                setFragments((prev) => prev.map((it, ix) => ix === idx ? { ...it, enabled: checked } : it));
                              }
                            } catch {
                              toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                            }
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-dashed border-border rounded-xl p-6 bg-muted/30 text-center">
                <p className="text-sm text-muted-foreground">Nenhum fragmento cadastrado.</p>
              </div>
            )}
            
          </CardContent>
        </Card>
        )}
      </div>

      <Dialog open={openConhecimento} onOpenChange={setOpenConhecimento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Conhecimento</DialogTitle>
            <DialogDescription>Apenas clique no botão Salvar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nome do Conhecimento</Label>
            <Input value={knowledgeName} readOnly />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenConhecimento(false)}>Cancelar</Button>
              <Button disabled={loading} onClick={async () => {
                if (!user) return;
                const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                if (!API_TOKEN) {
                  toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                  return;
                }
                setLoading(true);
                try {
                  const response = await fetch(`${API_URL}/datasets`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: knowledgeName })
                  });
                  let knowledgeId = '';
                  if (response.status === 409) {
                    const listRes = await fetch(`${API_URL}/datasets`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
                    const listJson = await listRes.json();
                    const items = Array.isArray(listJson) ? listJson : (Array.isArray(listJson?.data) ? listJson.data : []);
                    const match = items.find((x: any) => (x?.name || x?.dataset_name) === knowledgeName);
                    knowledgeId = match?.id || match?.dataset_id || '';
                  } else {
                    const json = await response.json();
                    knowledgeId = json?.id || json?.dataset_id || json?.data?.id || '';
                  }
                  if (!knowledgeId) {
                    toast({ title: 'Erro ao criar conhecimento', description: `Falha na criação ou busca. Código: ${response.status}` });
                  } else {
                    if (base) {
                      const { data, error } = await updateBaseConhecimentoByUser(user.id, { conhecimento_id: knowledgeId });
                      console.log('Supabase update conhecimento_id result:', { data, error });
                      if (!data || error) {
                        const created = await createBaseConhecimentoForUser(user.id, knowledgeId);
                        console.log('Supabase insert conhecimento_id result:', created);
                        setBase(created.data ?? null);
                      } else {
                        setBase(data);
                      }
                    } else {
                      const created = await createBaseConhecimentoForUser(user.id, knowledgeId);
                      console.log('Supabase insert (no base) conhecimento_id result:', created);
                      setBase(created.data ?? null);
                    }
                    try {
                      const updateRes = await fetch(`${API_URL}/datasets/${knowledgeId}`, {
                        method: 'PATCH',
                        headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          embedding_model: 'text-embedding-3-large',
                          embedding_model_provider: 'langgenius/openai/openai',
                          retrieval_model: {
                            search_method: 'semantic_search',
                            reranking_enable: false,
                            reranking_model: { reranking_provider_name: '', reranking_model_name: '' },
                            top_k: 3,
                            score_threshold_enabled: false,
                            score_threshold: 0.0
                          }
                        })
                      });
                      if (!updateRes.ok) {
                        toast({ title: 'Aviso', description: 'Não foi possível ajustar as configurações padrão.' });
                      }
                    } catch {}
                    try {
                      const tagName = ((user?.empresa || '').trim()) || 'Empresa';
                      const tagRes = await fetch(`${API_URL}/datasets/tags`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: tagName })
                      });
                      const tagJson = await tagRes.json();
                      const tagId = tagJson?.id || tagJson?.data?.id || tagJson?.tag?.id || '';
                      if (!tagId) {
                        toast({ title: 'Aviso', description: 'Tag não criada. Verifique o nome da empresa.' });
                      } else {
                        const bindRes = await fetch(`${API_URL}/datasets/tags/binding`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ target_id: knowledgeId, tag_ids: [tagId] })
                        });
                        if (!bindRes.ok) {
                          toast({ title: 'Aviso', description: 'Não foi possível vincular a tag ao conhecimento.' });
                        }
                      }
                    } catch {}
                    setOpenConhecimento(false);
                    toast({ title: 'Conhecimento criado', description: `ID: ${knowledgeId}` });
                  }
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                } finally {
                  setLoading(false);
                }
              }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openEditFragment} onOpenChange={setOpenEditFragment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Fragmento</DialogTitle>
            <DialogDescription>Atualize a pergunta e resposta do fragmento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Pergunta</Label>
            <Textarea value={editFragPergunta} onChange={(e) => setEditFragPergunta(e.target.value)} rows={3} />
            <Label>Resposta</Label>
            <Textarea value={editFragResposta} onChange={(e) => setEditFragResposta(e.target.value)} rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenEditFragment(false)}>Cancelar</Button>
              <Button disabled={loading || !base?.conhecimento_id || !base?.documento_id || !editingSegmentId || !editFragPergunta || !editFragResposta} onClick={async () => {
                if (!user || !base?.conhecimento_id || !base?.documento_id || !editingSegmentId) return;
                const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                if (!API_TOKEN) {
                  toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                  return;
                }
                setLoading(true);
                try {
                  const content = `${editFragPergunta}\n\n${editFragResposta}`;
                  const res = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments/${editingSegmentId}`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ segment: { content, keywords: [], enabled: true, regenerate_child_chunks: true } })
                  });
                  if (!res.ok) {
                    toast({ title: 'Erro ao editar fragmento', description: `Código: ${res.status}` });
                  } else {
                    const segRes = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments?page=1&limit=20`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
                    const segJson = await segRes.json();
                    const items = Array.isArray(segJson) ? segJson : (Array.isArray(segJson?.data) ? segJson.data : []);
                    setFragments(items);
                    setOpenEditFragment(false);
                    setEditingSegmentId(null);
                    setEditFragPergunta('');
                    setEditFragResposta('');
                    toast({ title: 'Fragmento atualizado', description: 'As alterações foram salvas.' });
                  }
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                } finally {
                  setLoading(false);
                }
              }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAISuggestions} onOpenChange={setOpenAISuggestions}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugestões da IA</DialogTitle>
            <DialogDescription>Revise e aceite ou recuse cada sugestão.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {aiSuggestions.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma sugestão disponível.</div>
            ) : (
              aiSuggestions.map((q, i) => (
                <div key={i} className={`rounded-xl p-4 border ${rejected.includes(i) ? 'bg-red-100 border-red-200' : 'bg-muted/30 border-border'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm text-foreground flex-1">{q}</div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="hover:bg-[#EBF57D]" onClick={() => {
                        const cleaned = q.replace(/^\d+\.\s*/, '').trim();
                        setAcceptIndex(i);
                        setAcceptQuestion(cleaned);
                        setAcceptAnswer('');
                        setOpenAcceptFragment(true);
                      }}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="hover:bg-[#EBF57D]" onClick={() => {
                        if (!rejected.includes(i)) setRejected([...rejected, i]);
                      }}>
                        <X className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAcceptFragment} onOpenChange={setOpenAcceptFragment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Pergunta</DialogTitle>
            <DialogDescription>Preencha a resposta para adicionar ao documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Pergunta</Label>
            <Textarea value={acceptQuestion} readOnly rows={3} />
            <Label>Resposta</Label>
            <Textarea value={acceptAnswer} onChange={(e) => setAcceptAnswer(e.target.value)} rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenAcceptFragment(false)}>Cancelar</Button>
              <Button disabled={loading || !base?.conhecimento_id || !base?.documento_id || !acceptQuestion || !acceptAnswer} onClick={async () => {
                if (!user || !base?.conhecimento_id || !base?.documento_id || acceptIndex === null) return;
                const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                if (!API_TOKEN) {
                  toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                  return;
                }
                setLoading(true);
                try {
                  const content = `${acceptQuestion}\n\n${acceptAnswer}`;
                  const response = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ segments: [{ content, keywords: [] }] })
                  });
                  if (!response.ok) {
                    toast({ title: 'Erro ao criar fragmento', description: `Código: ${response.status}` });
                  } else {
                    const segRes = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments?page=1&limit=20`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
                    const segJson = await segRes.json();
                    const items = Array.isArray(segJson) ? segJson : (Array.isArray(segJson?.data) ? segJson.data : []);
                    setFragments(items);
                    if (acceptIndex !== null) {
                      setAISuggestions(aiSuggestions.filter((_, idx) => idx !== acceptIndex));
                    }
                    setOpenAcceptFragment(false);
                    setAcceptIndex(null);
                    setAcceptQuestion('');
                    setAcceptAnswer('');
                    toast({ title: 'Pergunta adicionada', description: 'A sugestão foi salva como fragmento.' });
                  }
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                } finally {
                  setLoading(false);
                }
              }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openDocumento} onOpenChange={setOpenDocumento}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Documento</DialogTitle>
            <DialogDescription>Precisamos criar sua primeira pergunta e resposta para esse documento.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Nome do Documento</Label>
            <Input value={documentName} readOnly />
            <Label>Pergunta</Label>
            <Textarea value={fragPergunta} onChange={(e) => setFragPergunta(e.target.value)} placeholder="O que vocês fazem? Vocês são de onde?" rows={3} />
            <Label>Resposta</Label>
            <Textarea value={fragResposta} onChange={(e) => setFragResposta(e.target.value)} placeholder="Nós fazermos X coisas e atualmente estamos localizado em São Paulo" rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenDocumento(false)}>Cancelar</Button>
              <Button disabled={loading || !base?.conhecimento_id || !fragPergunta || !fragResposta} onClick={async () => {
                if (!user || !base?.conhecimento_id) return;
                const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                if (!API_TOKEN) {
                  toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                  return;
                }
                setLoading(true);
                try {
                  const text = `${fragPergunta}\n\n${fragResposta}`;
                  const response = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/document/create_by_text`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: documentName, text, indexing_technique: 'high_quality', process_rule: { mode: 'automatic' } })
                  });
                  let docId = '';
                  const json = await response.json();
                  docId = json?.document?.id || json?.id || json?.document_id || json?.data?.id || '';
                  if (!docId) {
                    toast({ title: 'Erro ao criar documento', description: `Resposta inválida. Código: ${response.status}` });
                  } else {
                    if (base) {
                      const { data, error } = await updateBaseConhecimentoByUser(user.id, { documento_id: docId });
                      console.log('Supabase update documento_id result:', { data, error });
                      if (error || !data) {
                        const created = await createBaseConhecimentoForUser(user.id, base.conhecimento_id ?? null, docId);
                        console.log('Supabase insert documento_id result:', created);
                        if (created.error || !created.data) {
                          toast({ title: 'Erro ao salvar documento', description: 'Falha ao persistir no Supabase.' });
                        } else {
                          setBase(created.data);
                        }
                      } else {
                        setBase(data);
                      }
                    } else {
                      const created = await createBaseConhecimentoForUser(user.id, null, docId);
                      console.log('Supabase insert (no base) documento_id result:', created);
                      if (created.error || !created.data) {
                        toast({ title: 'Erro ao criar base', description: 'Falha ao inserir no Supabase.' });
                      } else {
                        setBase(created.data);
                      }
                    }
                    
                    setOpenDocumento(false);
                    setFragPergunta('');
                    setFragResposta('');
                    toast({ title: 'Documento criado', description: `ID: ${docId}` });
                  }
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                } finally {
                  setLoading(false);
                }
              }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openFragment} onOpenChange={setOpenFragment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Fragmento</DialogTitle>
            <DialogDescription>Crie um novo fragmento com pergunta e resposta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Pergunta</Label>
            <Textarea value={newFragPergunta} onChange={(e) => setNewFragPergunta(e.target.value)} placeholder="O que vocês fazem? Vocês são de onde?" rows={3} />
            <Label>Resposta</Label>
            <Textarea value={newFragResposta} onChange={(e) => setNewFragResposta(e.target.value)} placeholder="Nós fazermos X coisas e atualmente estamos localizado em São Paulo" rows={4} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpenFragment(false)}>Cancelar</Button>
              <Button disabled={loading || !base?.conhecimento_id || !base?.documento_id || !newFragPergunta || !newFragResposta} onClick={async () => {
                if (!user || !base?.conhecimento_id || !base?.documento_id) return;
                const API_URL = import.meta.env.VITE_KNOWLEDGE_API_URL || 'https://api-production-42480.up.railway.app/v1';
                const API_TOKEN = import.meta.env.VITE_KNOWLEDGE_API_TOKEN;
                if (!API_TOKEN) {
                  toast({ title: 'Configuração ausente', description: 'Token da API não configurado.' });
                  return;
                }
                setLoading(true);
                try {
                  const content = `${newFragPergunta}\n\n${newFragResposta}`;
                  const response = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ segments: [{ content, keywords: [] }] })
                  });
                  if (!response.ok) {
                    toast({ title: 'Erro ao criar fragmento', description: `Código: ${response.status}` });
                  } else {
                    const segRes = await fetch(`${API_URL}/datasets/${base.conhecimento_id}/documents/${base.documento_id}/segments?page=1&limit=20`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
                    const segJson = await segRes.json();
                    const items = Array.isArray(segJson) ? segJson : (Array.isArray(segJson?.data) ? segJson.data : []);
                    setFragments(items);
                    setOpenFragment(false);
                    setNewFragPergunta('');
                    setNewFragResposta('');
                    toast({ title: 'Fragmento criado', description: 'O fragmento foi adicionado ao documento.' });
                  }
                } catch (e) {
                  toast({ title: 'Erro de rede', description: 'Não foi possível contatar a API.' });
                } finally {
                  setLoading(false);
                }
              }}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BaseDeConhecimento;