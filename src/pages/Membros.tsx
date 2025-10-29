import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Membro, getMembrosByUser, createUserAndAddMembro, updateMembro, deleteMembroComplete } from '@/lib/membros';
// Importando os componentes de UI
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, Plus, Crown, User, Trash2, UserX, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function Membros() {
  const { user } = useCRM();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
    cargo: 'Usuario' as 'Usuario'
  });

  // Estados para confirmações
  const [deleteAlert, setDeleteAlert] = useState<{ open: boolean; membro: Membro | null }>({ open: false, membro: null });
  const [deactivateAlert, setDeactivateAlert] = useState<{ open: boolean; membro: Membro | null }>({ open: false, membro: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Carregar membros
  useEffect(() => {
    loadMembros();
  }, [user]);

  const loadMembros = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Se é usuário master, usar seu próprio ID
      // Se é membro, usar o user_id_empresa
      const userIdToSearch = user.isMembro ? user.user_id_empresa : user.id;
      
      const result = await getMembrosByUser(userIdToSearch);
      if (result.data) {
        setMembros(result.data);
      } else {
        console.error('Erro ao carregar membros:', result.error);
      }
    } catch (error) {
      console.error('Erro ao carregar membros:', error);
    } finally {
      setLoading(false);
    }
  };

  // Função para excluir membro
  const handleDeleteMembro = async (membro: Membro) => {
    setActionLoading(`delete-${membro.membro_id}`);
    
    try {
      const result = await deleteMembroComplete(membro.membro_id, membro.membro_email);
      
      if (result.success) {
        // Remover da lista local
        setMembros(prev => prev.filter(m => m.membro_id !== membro.membro_id));
        setMessage({ type: 'success', text: 'Membro excluído com sucesso!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao excluir membro: ' + (result.error?.message || 'Erro desconhecido') });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      console.error('Erro ao excluir membro:', error);
      setMessage({ type: 'error', text: 'Erro inesperado ao excluir membro' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setActionLoading(null);
      setDeleteAlert({ open: false, membro: null });
    }
  };

  // Função para desativar membro
  const handleDeactivateMembro = async (membro: Membro) => {
    setActionLoading(`deactivate-${membro.membro_id}`);
    
    try {
      const result = await updateMembro(membro.membro_id, { membro_status: 'Desativado' });
      
      if (result.data) {
        // Atualizar na lista local
        setMembros(prev => prev.map(m => 
          m.membro_id === membro.membro_id 
            ? { ...m, membro_status: 'Desativado' }
            : m
        ));
        setMessage({ type: 'success', text: 'Membro desativado com sucesso!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao desativar membro: ' + (result.error?.message || 'Erro desconhecido') });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      console.error('Erro ao desativar membro:', error);
      setMessage({ type: 'error', text: 'Erro inesperado ao desativar membro' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setActionLoading(null);
      setDeactivateAlert({ open: false, membro: null });
    }
  };

  // Função para reativar membro
  const handleReactivateMembro = async (membro: Membro) => {
    setActionLoading(`reactivate-${membro.membro_id}`);
    
    try {
      const result = await updateMembro(membro.membro_id, { membro_status: 'Ativo' });
      
      if (result.data) {
        // Atualizar na lista local
        setMembros(prev => prev.map(m => 
          m.membro_id === membro.membro_id 
            ? { ...m, membro_status: 'Ativo' }
            : m
        ));
        setMessage({ type: 'success', text: 'Membro reativado com sucesso!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao reativar membro: ' + (result.error?.message || 'Erro desconhecido') });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      console.error('Erro ao reativar membro:', error);
      setMessage({ type: 'error', text: 'Erro inesperado ao reativar membro' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.telefone || !formData.senha) {
      setMessage({ type: 'error', text: 'Todos os campos são obrigatórios' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    if (!user) {
      setMessage({ type: 'error', text: 'Usuário não encontrado' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await createUserAndAddMembro(
        formData.email,
        formData.senha,
        formData.nome,
        formData.telefone,
        formData.cargo,
        'Ativo',
        user.isMembro ? user.user_id_empresa : user.id
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Membro adicionado com sucesso!' });
        setFormData({ nome: '', email: '', telefone: '', senha: '', cargo: 'Usuario' });
        setIsDialogOpen(false);
        loadMembros(); // Recarregar a lista
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: result.error?.message || 'Erro ao adicionar membro' });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
      setMessage({ type: 'error', text: 'Erro inesperado ao adicionar membro' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const canAddMembers = () => {
    if (!user) return false;
    
    // Se é usuário da tabela usuarios (master), sempre pode
    if (!user.isMembro) {
      return true;
    }
    
    // Se é membro, buscar na lista para verificar cargo
    const currentMember = membros.find(m => m.membro_email === user.email);
    if (!currentMember) return false;
    
    // Apenas administradores podem adicionar membros
    return currentMember.membro_cargo === 'Administrador';
  };

  const getAvatarColor = (nome: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    
    const index = nome.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getInitials = (nome: string) => {
    return nome
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando membros...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Membros da Equipe</h1>
          <p className="text-muted-foreground mt-2">Gerencie os membros da sua equipe</p>
        </div>
        
        {canAddMembers() && (
          <Button 
            onClick={() => setIsDialogOpen(true)}
            className="flex items-center gap-2"
            style={{ backgroundColor: '#EBF57D', color: '#000000' }}
          >
            <Plus className="h-4 w-4" />
            Adicionar Membro
          </Button>
        )}
      </div>

      {/* Mensagem de feedback global */}
      {message.text && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {membros.length === 0 ? (
        <div className="text-center py-12">
          <UserCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum membro encontrado</h3>
          <p className="text-muted-foreground mb-6">Comece adicionando o primeiro membro da sua equipe</p>
          {canAddMembers() && (
            <Button 
              onClick={() => setIsDialogOpen(true)}
              style={{ backgroundColor: '#EBF57D', color: '#000000' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Membro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {membros.map((membro) => (
            <Card 
              key={membro.membro_id} 
              className={`bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden relative ${
                membro.membro_status === 'Desativado' ? 'opacity-60' : ''
              }`}
            >
              {/* Menu de ações */}
              {canAddMembers() && (
                <div className="absolute top-2 right-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-[#EBF57D] hover:text-black"
                        disabled={actionLoading?.includes(membro.membro_id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {membro.membro_status === 'Ativo' ? (
                        <DropdownMenuItem
                          onClick={() => setDeactivateAlert({ open: true, membro })}
                          className="text-orange-600 focus:text-orange-600"
                          disabled={actionLoading?.includes(membro.membro_id)}
                        >
                          <UserX className="h-4 w-4 mr-2" />
                          Desativar Membro
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleReactivateMembro(membro)}
                          className="text-green-600 focus:text-green-600"
                          disabled={actionLoading?.includes(membro.membro_id)}
                        >
                          <User className="h-4 w-4 mr-2" />
                          Reativar Membro
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeleteAlert({ open: true, membro })}
                        className="text-red-600 focus:text-red-600"
                        disabled={actionLoading?.includes(membro.membro_id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir Membro
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className={`h-16 w-16 ${getAvatarColor(membro.membro_nome)}`}>
                    <AvatarFallback className="text-lg font-semibold text-white">{getInitials(membro.membro_nome)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground leading-tight">{membro.membro_nome}</h3>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="truncate">{membro.membro_email}</p>
                      {membro.membro_telefone && (
                        <p className="truncate">{membro.membro_telefone}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-1.5 px-2 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-full border border-blue-200 dark:border-blue-800">
                        <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          Usuário
                        </span>
                      </div>
                      
                      {membro.membro_status === 'Desativado' && (
                        <Badge variant="destructive" className="text-xs">
                          Desativado
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog para adicionar membro */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Membro</DialogTitle>
            <DialogDescription>
              Preencha as informações do novo membro da equipe
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome completo do novo membro</Label>
              <Input
                id="nome"
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome completo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail do novo membro</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Digite o e-mail"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone do novo membro</Label>
              <Input
                id="telefone"
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                placeholder="Digite o telefone"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha">Senha de acesso para o novo membro</Label>
              <Input
                id="senha"
                type="password"
                value={formData.senha}
                onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                placeholder="Digite a senha"
                required
              />
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDialogOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                style={{ backgroundColor: '#EBF57D', color: '#000000' }}
              >
                {isLoading ? 'Adicionando...' : 'Adicionar Membro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para excluir */}
      <AlertDialog open={deleteAlert.open} onOpenChange={(open) => setDeleteAlert({ open, membro: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteAlert.membro?.membro_nome}</strong>?
              <br />
              <span className="text-red-600 font-medium">Esta ação não pode ser desfeita e removerá o membro da tabela e do sistema de autenticação.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAlert.membro && handleDeleteMembro(deleteAlert.membro)}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading?.includes('delete')}
            >
              {actionLoading?.includes('delete') ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para desativar */}
      <AlertDialog open={deactivateAlert.open} onOpenChange={(open) => setDeactivateAlert({ open, membro: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar <strong>{deactivateAlert.membro?.membro_nome}</strong>?
              <br />
              O membro não poderá mais acessar o sistema até ser reativado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deactivateAlert.membro && handleDeactivateMembro(deactivateAlert.membro)}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={actionLoading?.includes('deactivate')}
            >
              {actionLoading?.includes('deactivate') ? 'Desativando...' : 'Desativar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Membros;