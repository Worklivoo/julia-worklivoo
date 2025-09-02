import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Lock, LogOut, Plus, Edit, ExternalLink, UserX, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ConsoleClient } from '@/types';
import { useToast } from '@/hooks/use-toast';

const Console = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clients, setClients] = useState<ConsoleClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingClient, setEditingClient] = useState<ConsoleClient | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();
  const correctPassword = 'worklivoo2025';

  // Verificar se o usuário já está autenticado no console ao carregar a página
  useEffect(() => {
    const savedAuth = localStorage.getItem('console_authenticated');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  // Carregar clientes quando autenticado
  useEffect(() => {
    if (isAuthenticated) {
      loadClients();
    }
  }, [isAuthenticated]);

  // Função para carregar todos os clientes
  const loadClients = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('console')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao carregar clientes: ' + error.message,
          variant: 'destructive',
        });
        return;
      }

      setClients(data || []);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao carregar clientes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Função para alternar status ativo/inativo do cliente
  const toggleClientStatus = async (client: ConsoleClient) => {
    try {
      const { error } = await supabase
        .from('console')
        .update({ cliente_ativo: !client.cliente_ativo })
        .eq('id', client.id);

      if (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao atualizar status do cliente',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: `Cliente ${!client.cliente_ativo ? 'ativado' : 'desativado'} com sucesso`,
      });
      
      loadClients();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao atualizar cliente',
        variant: 'destructive',
      });
    }
  };

  // Função para excluir cliente
  const deleteClient = async (client: ConsoleClient) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${client.nome}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('console')
        .delete()
        .eq('id', client.id);

      if (error) {
        toast({
          title: 'Erro',
          description: 'Erro ao excluir cliente',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: 'Cliente excluído com sucesso',
      });
      
      loadClients();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro inesperado ao excluir cliente',
        variant: 'destructive',
      });
    }
  };

  // Função para navegar para a página do cliente
  const goToClientPage = (client: ConsoleClient) => {
    const clientUrl = `${window.location.origin}/${client.url}`;
    window.open(clientUrl, '_blank');
  };

  // Função para alternar visibilidade da senha
  const togglePasswordVisibility = (clientId: string) => {
    setShowPassword(prev => ({
      ...prev,
      [clientId]: !prev[clientId]
    }));
  };

  const handleEditClient = (client: ConsoleClient) => {
    setEditingClient(client);
    setIsDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!editingClient) return;

    try {
      const { error } = await supabase
        .from('console')
        .update({
          nome: editingClient.nome,
          url: editingClient.url,
          senha: editingClient.senha,
          webhook_url: editingClient.webhook_url,
          dify_token: editingClient.dify_token,
          cliente_ativo: editingClient.cliente_ativo,
          mensagem_inicial: editingClient.mensagem_inicial
        })
        .eq('id', editingClient.id);

      if (error) throw error;

      toast({
        title: "Cliente atualizado",
        description: "As informações do cliente foram atualizadas com sucesso.",
      });

      setIsDialogOpen(false);
      setEditingClient(null);
      loadClients();
    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar cliente. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCreateClient = async (newClient: Omit<ConsoleClient, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('console')
        .insert([newClient]);

      if (error) throw error;

      toast({
        title: "Cliente criado",
        description: "Novo cliente foi criado com sucesso.",
      });

      loadClients();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar cliente. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleLogin = () => {
    if (password === correctPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('console_authenticated', 'true');
      setPassword('');
    } else {
      toast({
        title: 'Erro',
        description: 'Senha incorreta!',
        variant: 'destructive',
      });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('console_authenticated');
    setClients([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Lock className="h-5 w-5" />
              Console Worklivoo
            </CardTitle>
            <CardDescription>
              Digite a senha para acessar o painel administrativo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Digite a senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Entrar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Console Worklivoo</h1>
          <p className="text-muted-foreground">Painel Administrativo</p>
        </div>
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                style={{ backgroundColor: '#EBF57D' }}
                className="text-black hover:opacity-90"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Cliente</DialogTitle>
                <DialogDescription>
                  Preencha as informações do novo cliente
                </DialogDescription>
              </DialogHeader>
              <CreateClientForm onSubmit={handleCreateClient} />
            </DialogContent>
          </Dialog>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair do Console
          </Button>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Carregando clientes...</div>
        </div>
      ) : (
        <div className="grid gap-6">
          {clients.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">Nenhum cliente encontrado</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button style={{ backgroundColor: '#EBF57D' }} className="text-black hover:opacity-90">
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Primeiro Cliente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Criar Novo Cliente</DialogTitle>
                        <DialogDescription>
                          Preencha as informações do novo cliente
                        </DialogDescription>
                      </DialogHeader>
                      <CreateClientForm onSubmit={handleCreateClient} />
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ) : (
            clients.map((client) => (
              <Card key={client.id} className="w-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{client.nome}</CardTitle>
                      <Badge variant={client.cliente_ativo ? 'default' : 'secondary'}>
                        {client.cliente_ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => goToClientPage(client)}
                        title="Ir para página do cliente"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditClient(client)}
                        title="Editar cliente"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleClientStatus(client)}
                        title={client.cliente_ativo ? 'Desativar cliente' : 'Ativar cliente'}
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteClient(client)}
                        title="Excluir cliente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">URL</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded">{client.url}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Senha</Label>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-mono bg-muted p-2 rounded flex-1">
                          {showPassword[client.id] ? client.senha : '••••••••'}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => togglePasswordVisibility(client.id)}
                        >
                          {showPassword[client.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">User ID</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded">{client.user_id}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Webhook URL</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded truncate" title={client.webhook_url}>
                        {client.webhook_url}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Dify Token</Label>
                      <p className="text-sm font-mono bg-muted p-2 rounded truncate" title={client.dify_token}>
                        {client.dify_token}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Criado em</Label>
                      <p className="text-sm bg-muted p-2 rounded">
                        {new Date(client.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {client.mensagem_inicial && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium text-muted-foreground">Mensagem Inicial</Label>
                      <p className="text-sm bg-muted p-3 rounded mt-1">{client.mensagem_inicial}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal de Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Edite as informações do cliente
            </DialogDescription>
          </DialogHeader>
          {editingClient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome do Cliente</Label>
                  <Input
                    id="nome"
                    value={editingClient.nome}
                    onChange={(e) => setEditingClient({...editingClient, nome: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="url">URL (User ID)</Label>
                  <Input
                    id="url"
                    value={editingClient.url}
                    onChange={(e) => setEditingClient({...editingClient, url: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  value={editingClient.senha}
                  onChange={(e) => setEditingClient({...editingClient, senha: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="webhook_url">Webhook URL</Label>
                <Input
                  id="webhook_url"
                  value={editingClient.webhook_url || ''}
                  onChange={(e) => setEditingClient({...editingClient, webhook_url: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="dify_token">Dify Token</Label>
                <Input
                  id="dify_token"
                  value={editingClient.dify_token || ''}
                  onChange={(e) => setEditingClient({...editingClient, dify_token: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="mensagem_inicial">Mensagem Inicial</Label>
                <Textarea
                  id="mensagem_inicial"
                  value={editingClient.mensagem_inicial || ''}
                  onChange={(e) => setEditingClient({...editingClient, mensagem_inicial: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="cliente_ativo"
                  checked={editingClient.cliente_ativo}
                  onCheckedChange={(checked) => setEditingClient({...editingClient, cliente_ativo: checked})}
                />
                <Label htmlFor="cliente_ativo">Cliente Ativo</Label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveClient} style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Componente para criar novo cliente
const CreateClientForm: React.FC<{ onSubmit: (client: Omit<ConsoleClient, 'id' | 'created_at' | 'updated_at'>) => void }> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    nome: '',
    url: '',
    senha: '',
    webhook_url: '',
    dify_token: '',
    user_id: '',
    cliente_ativo: true,
    mensagem_inicial: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
    setFormData({
      nome: '',
      url: '',
      senha: '',
      webhook_url: '',
      dify_token: '',
      user_id: '',
      cliente_ativo: true,
      mensagem_inicial: ''
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="new-nome">Nome do Cliente</Label>
          <Input
            id="new-nome"
            value={formData.nome}
            onChange={(e) => setFormData({...formData, nome: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="new-url">URL (User ID)</Label>
          <Input
            id="new-url"
            value={formData.url}
            onChange={(e) => setFormData({...formData, url: e.target.value})}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="new-senha">Senha</Label>
          <Input
            id="new-senha"
            type="password"
            value={formData.senha}
            onChange={(e) => setFormData({...formData, senha: e.target.value})}
            required
          />
        </div>
        <div>
          <Label htmlFor="new-user_id">User ID</Label>
          <Input
            id="new-user_id"
            value={formData.user_id}
            onChange={(e) => setFormData({...formData, user_id: e.target.value})}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="new-webhook_url">Webhook URL</Label>
        <Input
          id="new-webhook_url"
          value={formData.webhook_url}
          onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="new-dify_token">Dify Token</Label>
        <Input
          id="new-dify_token"
          value={formData.dify_token}
          onChange={(e) => setFormData({...formData, dify_token: e.target.value})}
        />
      </div>
      <div>
        <Label htmlFor="new-mensagem_inicial">Mensagem Inicial</Label>
        <Textarea
          id="new-mensagem_inicial"
          value={formData.mensagem_inicial}
          onChange={(e) => setFormData({...formData, mensagem_inicial: e.target.value})}
          rows={3}
        />
      </div>
      <div className="flex items-center space-x-2">
        <Switch
          id="new-cliente_ativo"
          checked={formData.cliente_ativo}
          onCheckedChange={(checked) => setFormData({...formData, cliente_ativo: checked})}
        />
        <Label htmlFor="new-cliente_ativo">Cliente Ativo</Label>
      </div>
      <DialogFooter>
        <Button type="submit" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
          Criar Cliente
        </Button>
      </DialogFooter>
    </form>
  );
};

export default Console;