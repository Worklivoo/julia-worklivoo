import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/contexts/CRMContext';
import { User, Mail, Phone, Building, Crown, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addFonteDados, getFontesDadosByUser, updateFonteDados, getTelefoneQualificadoByUser, updateTelefoneQualificadoByUser, getFeedbacksByUser } from '@/lib/supabase-utils';
import { formatPhone } from '@/lib/lead-detail-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Membros from '@/pages/Membros';
import BaseDeConhecimento from '@/pages/BaseDeConhecimento';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePersistentTab } from '@/hooks/use-persistent-state';

const Settings = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = usePersistentTab('settings', 'gerais');
  const [tipo, setTipo] = useState<string>('HTML');
  const [links, setLinks] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [isSubmittingFontes, setIsSubmittingFontes] = useState<boolean>(false);
  const [fontes, setFontes] = useState<any[]>([]);
  const [loadingFontes, setLoadingFontes] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editData, setEditData] = useState<{ id: string; tipo: string; links: string; body: string | '' } | null>(null);
  const [telefoneQualificado, setTelefoneQualificado] = useState<string | null>(null);
  const [editTelefoneOpen, setEditTelefoneOpen] = useState<boolean>(false);
  const [telefoneQualificadoEdit, setTelefoneQualificadoEdit] = useState<string>('');
  const [isSavingTelefone, setIsSavingTelefone] = useState<boolean>(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState<boolean>(false);

  useEffect(() => {
    setCliente(user?.empresa || '');
  }, [user?.empresa]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoadingFontes(true);
      const { data } = await getFontesDadosByUser(user.id);
      setFontes(data || []);
      setLoadingFontes(false);
    };
    load();
  }, [user?.id]);

  useEffect(() => {
    const loadTelefone = async () => {
      if (!user) return;
      const { data } = await getTelefoneQualificadoByUser(user.id);
      setTelefoneQualificado(data || null);
    };
    loadTelefone();
  }, [user?.id]);

  useEffect(() => {
    const loadFeedbacks = async () => {
      if (!user) return;
      setLoadingFeedbacks(true);
      const { data } = await getFeedbacksByUser(user.id);
      const negatives = (data || []).filter((f: any) => String(f?.comentario_tipo || '').toLowerCase() === 'negativo');
      setFeedbacks(negatives);
      setLoadingFeedbacks(false);
    };
    loadFeedbacks();
  }, [user?.id]);

  if (!user) {
    return (
      <div className="text-foreground transition-colors">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-muted-foreground">Carregando informações do usuário...</p>
        </div>
      </div>
    );
  }

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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

  const triggerFontesWebhook = async (params: { tipo: string; link: string; userId: string; body?: string | null }) => {
    const url = `https://primary-production-d442.up.railway.app/webhook/banco-dados${params.userId}`;
    const payload: any = { TIPO: params.tipo, LINK: params.link, USER_ID: params.userId };
    if (params.tipo === 'API') {
      let bodyObj: any = {};
      if (params.body && params.body.trim().length > 0) {
        try {
          bodyObj = JSON.parse(params.body);
        } catch (e: any) {
          toast({ title: 'Body inválido', description: 'JSON do body não é válido' });
        }
      }
      payload.BODY = bodyObj;
    }
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

  return (
    <div className="text-foreground transition-colors">
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent light-welcome-title">Configurações</h1>
            <p className="text-muted-foreground mt-1 text-lg">Gerencie suas preferências e fontes</p>
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="gerais">Gerais</TabsTrigger>
            <TabsTrigger value="fontes">Fontes de Dados</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
            <TabsTrigger value="base-de-conhecimento">Base de Conhecimento</TabsTrigger>
            <TabsTrigger value="historico-de-otimizacoes">Histórico de Otimizações</TabsTrigger>
          </TabsList>

          <TabsContent value="gerais" className="pt-4">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">Perfil do Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={undefined} alt={user.nome} />
                    <AvatarFallback className="text-lg font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                      {getInitials(user.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-2xl font-bold">{user.nome}</h2>
                    <p className="text-muted-foreground">Usuário do sistema</p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">ID do Usuário</p>
                      <p className="font-medium font-mono text-sm">{user.id}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="font-medium">{user.email}</p>
                    </div>
                  </div>

                  {user.telefone && (
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <div>
                      <p className="text-sm font-medium text-muted-foreground">Celular Principal</p>
                        <p className="font-medium">{formatPhone(user.telefone || '')}</p>
                      </div>
                    </div>
                  )}

                  {user.empresa && (
                    <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Empresa</p>
                        <p className="font-medium">{user.empresa}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Crown className="h-5 w-5 text-muted-foreground" />
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Plano</p>
                      </div>
                      {getPlanoBadge(user.plano)}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Telefone para Notificar</p>
                        <p className="font-medium">{telefoneQualificado ? formatPhone(telefoneQualificado) : '-'}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const digits = String(telefoneQualificado || '').replace(/\D/g, '');
                          const rest = digits.startsWith('55') ? digits.slice(2) : digits;
                          setTelefoneQualificadoEdit(rest);
                          setEditTelefoneOpen(true);
                        }}
                      >
                        Editar
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Dialog open={editTelefoneOpen} onOpenChange={setEditTelefoneOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Telefone para Notificar</DialogTitle>
                  <DialogDescription>Informe o número iniciando por DDD e número. O prefixo +55 será aplicado automaticamente.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-muted-foreground">Número</Label>
                  <div className="flex items-center">
                    <div className="bg-muted px-3 py-2 rounded-l-md border border-r-0 border-input">+55</div>
                    <Input
                      type="tel"
                      className="rounded-l-none"
                      placeholder="11999999999"
                      value={telefoneQualificadoEdit}
                      onChange={(e) => {
                        const onlyDigits = e.target.value.replace(/\D/g, '');
                        setTelefoneQualificadoEdit(onlyDigits);
                      }}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setEditTelefoneOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={async () => {
                        if (!user) return;
                        const rest = String(telefoneQualificadoEdit || '').replace(/\D/g, '');
                        if (!rest) {
                          toast({ title: 'Telefone inválido', description: 'Informe o DDD e número.' });
                          return;
                        }
                        const full = `55${rest}`.slice(0, 13);
                        setIsSavingTelefone(true);
                        const { error } = await updateTelefoneQualificadoByUser(user.id, full);
                        setIsSavingTelefone(false);
                        if (error) {
                          toast({ title: 'Erro ao salvar', description: 'Não foi possível atualizar o telefone.' });
                          return;
                        }
                        setTelefoneQualificado(full);
                        setEditTelefoneOpen(false);
                        toast({ title: 'Telefone atualizado', description: 'O número foi salvo com sucesso.' });
                      }}
                      disabled={isSavingTelefone}
                    >
                      {isSavingTelefone ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="fontes" className="pt-4 space-y-8">
            {fontes.length === 0 && (
              <Card className="border-border bg-card shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl font-semibold">Fontes de Dados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Tipo</Label>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tipo === 'HTML'}
                            onCheckedChange={(checked) => setTipo(checked ? 'HTML' : tipo === 'API' ? 'API' : 'HTML')}
                            className="data-[state=checked]:bg-[#EBF57D]"
                          />
                          <span>HTML</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={tipo === 'API'}
                            onCheckedChange={(checked) => setTipo(checked ? 'API' : tipo === 'HTML' ? 'HTML' : 'API')}
                            className="data-[state=checked]:bg-[#EBF57D]"
                          />
                          <span>API</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Links</Label>
                      <Textarea
                        placeholder="Insira um ou mais links, um por linha"
                        value={links}
                        onChange={(e) => setLinks(e.target.value)}
                        className="bg-background border-border"
                        rows={6}
                      />
                    </div>
                    {tipo === 'API' && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Body</Label>
                        <Textarea
                          placeholder="Opcional"
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          className="bg-background border-border"
                          rows={6}
                        />
                      </div>
                    )}
                    <div>
                      <Button
                        onClick={async () => {
                          if (!user) return;
                          const normalizedLinks = links
                            .split(/\r?\n/)
                            .map((l) => l.trim())
                            .filter((l) => l.length > 0)
                            .join('\n');
                          setIsSubmittingFontes(true);
                          const result = await addFonteDados({
                            tipo,
                            link: normalizedLinks,
                            body: tipo === 'API' && body ? body : null,
                            user_id: user.id,
                          });
                          setIsSubmittingFontes(false);
                          if (result.error) {
                            toast({ title: 'Erro ao salvar', description: 'Verifique os dados e tente novamente.' });
                            return;
                          }
                          toast({ title: 'Fonte de dados salva', description: 'As informações foram registradas.' });
                          await triggerFontesWebhook({ tipo, link: normalizedLinks, userId: user.id, body });
                          setFontes([result.data]);
                          setLinks('');
                          setBody('');
                          setCliente('');
                          setTipo('HTML');
                        }}
                        disabled={isSubmittingFontes || !tipo}
                        className="shadow-sm"
                      >
                        {isSubmittingFontes ? 'Salvando...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">Fontes salvas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingFontes ? (
                  <div className="text-muted-foreground">Carregando...</div>
                ) : fontes.length === 0 ? (
                  <div className="text-muted-foreground">Nenhum registro encontrado.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {fontes.map((f) => (
                      <div key={f.id || user.id} className="p-3 rounded-lg bg-muted/30 flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="text-sm">Tipo: {f.tipo}</div>
                          <div className="text-sm">Cliente: {f.cliente || '-'}</div>
                          <div className="text-xs text-foreground mt-2 whitespace-pre-wrap">{f.link}</div>
                          {f.body && <div className="text-xs text-foreground mt-2 whitespace-pre-wrap">{f.body}</div>}
                        </div>
                        <div>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setEditData({ id: f.id || user.id, tipo: f.tipo || 'HTML', links: f.link || '', body: f.body || '' });
                              setEditOpen(true);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Editar Fonte de Dados</DialogTitle>
                  <DialogDescription>Atualize as informações</DialogDescription>
                </DialogHeader>
                {editData && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editData.tipo === 'HTML'}
                          onCheckedChange={(checked) => setEditData(prev => prev ? { ...prev, tipo: checked ? 'HTML' : prev.tipo } : prev)}
                          className="data-[state=checked]:bg-[#EBF57D]"
                        />
                        <span>HTML</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editData.tipo === 'API'}
                          onCheckedChange={(checked) => setEditData(prev => prev ? { ...prev, tipo: checked ? 'API' : prev.tipo } : prev)}
                          className="data-[state=checked]:bg-[#EBF57D]"
                        />
                        <span>API</span>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Insira um ou mais links, um por linha"
                      value={editData.links}
                      onChange={(e) => setEditData(prev => prev ? { ...prev, links: e.target.value } : prev)}
                      className="bg-background border-border"
                      rows={6}
                    />
                    {editData.tipo === 'API' && (
                      <Textarea
                        placeholder="Opcional"
                        value={editData.body}
                        onChange={(e) => setEditData(prev => prev ? { ...prev, body: e.target.value } : prev)}
                        className="bg-background border-border"
                        rows={6}
                      />
                    )}
                    <div className="flex gap-2 justify-end">
                      <Button
                        onClick={async () => {
                          if (!user || !editData) return;
                          const normalizedLinks = editData.links
                            .split(/\r?\n/)
                            .map((l) => l.trim())
                            .filter((l) => l.length > 0)
                            .join('\n');
                          const { data, error } = await updateFonteDados(user.id, {
                            tipo: editData.tipo,
                            link: normalizedLinks,
                            body: editData.tipo === 'API' && editData.body ? editData.body : null,
                          });
                          if (error) {
                            toast({ title: 'Erro ao atualizar', description: 'Verifique os dados e tente novamente.' });
                            return;
                          }
                          setFontes(prev => prev.map(f => f.id === data.id ? data : f));
                          await triggerFontesWebhook({ tipo: editData.tipo, link: normalizedLinks, userId: user.id, body: editData.body });
                          setEditOpen(false);
                          setEditData(null);
                          toast({ title: 'Fonte de dados atualizada', description: 'As informações foram alteradas.' });
                        }}
                      >
                        Salvar alterações
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="membros" className="pt-4">
            <Membros />
          </TabsContent>

          <TabsContent value="base-de-conhecimento" className="pt-4">
            <BaseDeConhecimento />
          </TabsContent>

          <TabsContent value="historico-de-otimizacoes" className="pt-4">
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
                  <div className="rounded-xl border border-border/50 shadow-sm overflow-hidden">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Feedback</TableHead>
                          <TableHead>USER</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbacks.map((f) => (
                          <TableRow key={String(f.feedback_id || `${f.user_id}-${f.mensagem_id}-${f.criado_em}`)}>
                            <TableCell>{f.criado_em ? new Date(f.criado_em).toLocaleString('pt-BR') : '-'}</TableCell>
                            <TableCell className="max-w-[320px] truncate">{f.comentario_mensagem || '-'}</TableCell>
                            <TableCell>{String(f.dify_user ?? '')}</TableCell>
                            <TableCell>
                              {(() => {
                                const s = String(f.status || '').trim().toUpperCase();
                                if (s === 'OK') {
                                  return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">OK</Badge>;
                                }
                                if (s === 'EM ANÁLISE') {
                                  return <Badge variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">EM ANÁLISE</Badge>;
                                }
                                if (!s) {
                                  return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Em Andamento</Badge>;
                                }
                                return <Badge variant="outline">{s}</Badge>;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
