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
import { addFonteDados, getFontesDadosByUser, updateFonteDados } from '@/lib/supabase-utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Membros from '@/pages/Membros';
import BaseDeConhecimento from '@/pages/BaseDeConhecimento';

const Settings = () => {
  const { user } = useCRM();
  const { toast } = useToast();
  const [tipo, setTipo] = useState<string>('HTML');
  const [links, setLinks] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [cliente, setCliente] = useState<string>('');
  const [isSubmittingFontes, setIsSubmittingFontes] = useState<boolean>(false);
  const [fontes, setFontes] = useState<any[]>([]);
  const [loadingFontes, setLoadingFontes] = useState<boolean>(false);
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [editData, setEditData] = useState<{ id: string; tipo: string; links: string; body: string | '' } | null>(null);

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
        <Tabs defaultValue="gerais" className="w-full">
          <TabsList className="bg-muted/40">
            <TabsTrigger value="gerais">Gerais</TabsTrigger>
            <TabsTrigger value="fontes">Fontes de Dados</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
            <TabsTrigger value="base-de-conhecimento">Base de Conhecimento</TabsTrigger>
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
                        <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                        <p className="font-medium">{user.telefone}</p>
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
                </div>
              </CardContent>
            </Card>
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
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;
