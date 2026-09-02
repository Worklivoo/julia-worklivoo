import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Membro, getMembrosByUser, createUserAndAddMembro, updateMembro, deleteMembroComplete } from '@/lib/membros';
// Importando os componentes de UI
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, Plus, Crown, User, Trash2, UserX, MoreVertical, Eye, EyeOff, Pencil, CheckCircle2, AlertTriangle } from 'lucide-react';
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
import { supabase } from '@/lib/supabase';

function Membros() {
  const { user } = useCRM();
  const normalizePhone = (value: string) => value.replace(/\D/g, '');
  const normalizeAddMemberPhone = (value: string) => {
    const digits = normalizePhone(value);
    const withoutCountryCode = digits.startsWith('55') ? digits.slice(2) : digits;
    return withoutCountryCode.slice(0, 11);
  };
  const formatAddMemberPhone = (value: string) => {
    const digits = normalizeAddMemberPhone(value);
    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    const firstPartLength = number.length > 8 ? 5 : 4;
    const firstPart = number.slice(0, firstPartLength);
    const secondPart = number.slice(firstPartLength, firstPartLength + 4);

    let formatted = '';

    if (ddd.length > 0) {
      formatted += `(${ddd}`;
      if (ddd.length === 2) {
        formatted += ')';
      }
    }

    if (firstPart.length > 0) {
      formatted += ddd.length === 2 ? ` ${firstPart}` : firstPart;
    }

    if (secondPart.length > 0) {
      formatted += `-${secondPart}`;
    }

    return formatted;
  };
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewMemberPassword, setShowNewMemberPassword] = useState(false);
  const [editMemberOpen, setEditMemberOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Membro | null>(null);
  const [editMemberForm, setEditMemberForm] = useState<{ nome: string; telefone: string }>({ nome: '', telefone: '' });
  const [savingMemberEdit, setSavingMemberEdit] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    senha: '',
  });

  // Estados para confirmações
  const [deleteAlert, setDeleteAlert] = useState<{ open: boolean; membro: Membro | null }>({ open: false, membro: null });
  const [deactivateAlert, setDeactivateAlert] = useState<{ open: boolean; membro: Membro | null }>({ open: false, membro: null });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
      if (!userIdToSearch) {
        setMembros([]);
        return;
      }
      
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
    if (membro.membro_tipo === 'Administrador') {
      return;
    }
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
    if (membro.membro_tipo === 'Administrador') {
      return;
    }
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
    if (membro.membro_tipo === 'Administrador') {
      return;
    }
    setActionLoading(`reactivate-${membro.membro_id}`);
    
    try {
      const result = await updateMembro(membro.membro_id, { membro_status: 'Ativado' });
      
      if (result.data) {
        // Atualizar na lista local
        setMembros(prev => prev.map(m => 
          m.membro_id === membro.membro_id 
            ? { ...m, membro_status: 'Ativado' }
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

  const handleSendResetPasswordLink = async (membro: Membro) => {
    const email = String(membro.membro_email || '').trim();
    if (!email) {
      setMessage({ type: 'error', text: 'Este membro não possui e-mail cadastrado.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setOpenMenuId(null);
    setActionLoading(`reset-${membro.membro_id}`);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setMessage({ type: 'error', text: 'Erro ao enviar link de redefinição. Tente novamente.' });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
        return;
      }

      setMessage({ type: 'success', text: `Link de redefinição enviado para ${email}.` });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro inesperado ao enviar link de redefinição.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const openEditMemberDialog = (membro: Membro) => {
    setOpenMenuId(null);
    setEditingMember(membro);
    setEditMemberForm({
      nome: String(membro.membro_nome || ''),
      telefone: String(membro.membro_telefone || ''),
    });
    setEditMemberOpen(true);
  };

  const handleSaveEditMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const membro = editingMember;
    if (!membro) return;
    if (savingMemberEdit) return;

    const nome = editMemberForm.nome.trim();
    const telefone = normalizePhone(editMemberForm.telefone);
    if (!nome) {
      setMessage({ type: 'error', text: 'O nome é obrigatório.' });
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return;
    }

    setSavingMemberEdit(true);
    try {
      const result = await updateMembro(membro.membro_id, {
        membro_nome: nome,
        membro_telefone: telefone ? telefone : null,
      });

      if (result.data) {
        setMembros((prev) =>
          prev.map((m) =>
            m.membro_id === membro.membro_id ? { ...m, membro_nome: nome, membro_telefone: telefone ? telefone : null } : m
          )
        );
        setEditMemberOpen(false);
        setEditingMember(null);
        setMessage({ type: 'success', text: 'Membro atualizado com sucesso!' });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao atualizar membro: ' + ((result as any)?.error?.message || 'Erro desconhecido') });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro inesperado ao atualizar membro' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setSavingMemberEdit(false);
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
      const normalizedPhone = `55${normalizeAddMemberPhone(formData.telefone)}`;
      const result = await createUserAndAddMembro(
        formData.email,
        formData.senha,
        formData.nome,
        normalizedPhone,
        'Usuario',
        'Ativado',
        user.isMembro ? user.user_id_empresa : user.id
      );

      if (result.success) {
        setMessage({ type: 'success', text: 'Membro adicionado com sucesso!' });
        setFormData({ nome: '', email: '', telefone: '', senha: '' });
        setShowNewMemberPassword(false);
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
    const currentMember = membros.find(m => String(m.membro_email || '').toLowerCase() === String(user.email || '').toLowerCase());
    if (!currentMember) return false;
    
    // Apenas administradores podem adicionar membros
    return currentMember.membro_tipo === 'Administrador';
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
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-sm text-muted-foreground">Carregando membros...</div>
      </div>
    );
  }

  const visibleMembros = membros.filter((m) => m.membro_tipo !== 'Administrador');

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Membros da Equipe</h1>
          <p className="text-muted-foreground mt-1">Gerencie os membros da sua equipe</p>
        </div>
        
        {canAddMembers() && (
          <Button 
            onClick={() => setIsDialogOpen(true)}
            variant="secondary"
            size="sm"
            className="flex items-center gap-2 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            Adicionar Membro
          </Button>
        )}
      </div>

      {/* Mensagem de feedback global */}
      {message.text && (
        <div
          className={`rounded-2xl border p-4 text-sm font-medium ${
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : message.type === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
                : 'border-border/50 bg-gradient-to-br from-muted/30 to-transparent text-foreground'
          }`}
        >
          <div className="flex items-start gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5" />
            ) : message.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 mt-0.5" />
            ) : null}
            <div>{message.text}</div>
          </div>
        </div>
      )}

      {visibleMembros.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent py-12 text-center">
          <UserCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum membro encontrado</h3>
          <p className="text-muted-foreground mb-6">Comece adicionando o primeiro membro da sua equipe</p>
          {canAddMembers() && (
            <Button 
              onClick={() => setIsDialogOpen(true)}
              variant="secondary"
              className="rounded-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Primeiro Membro
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleMembros.map((membro) => (
            <Card 
              key={membro.membro_id} 
              className={`rounded-2xl border border-border/60 bg-card/80 shadow-sm overflow-hidden relative ${
                membro.membro_status === 'Desativado' ? 'opacity-60' : ''
              }`}
            >
              {/* Menu de ações */}
              {canAddMembers() && (
                <div className="absolute top-2 right-2">
                  <DropdownMenu
                    open={openMenuId === membro.membro_id}
                    onOpenChange={(open) => setOpenMenuId(open ? membro.membro_id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0 hover:bg-muted"
                        disabled={actionLoading?.includes(membro.membro_id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          handleSendResetPasswordLink(membro);
                        }}
                        disabled={actionLoading?.includes(membro.membro_id)}
                      >
                        <UserCircle className="h-4 w-4 mr-2" />
                        Redefinir Senha
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onSelect={(e) => {
                          e.preventDefault();
                          openEditMemberDialog(membro);
                        }}
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar informações
                      </DropdownMenuItem>

                      {membro.membro_tipo !== 'Administrador' && (
                        <>
                          {membro.membro_status === 'Ativado' ? (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                setDeactivateAlert({ open: true, membro });
                              }}
                              disabled={actionLoading?.includes(membro.membro_id)}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Desativar Membro
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                handleReactivateMembro(membro);
                              }}
                              disabled={actionLoading?.includes(membro.membro_id)}
                            >
                              <User className="h-4 w-4 mr-2" />
                              Reativar Membro
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onSelect={(e) => {
                              e.preventDefault();
                              setDeleteAlert({ open: true, membro });
                            }}
                            disabled={actionLoading?.includes(membro.membro_id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir Membro
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-foreground">{membro.membro_nome}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 p-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <Avatar className="h-16 w-16 rounded-2xl border border-border/60 bg-muted/30">
                    <AvatarFallback className="rounded-2xl bg-muted/30 text-lg font-semibold text-foreground">{getInitials(membro.membro_nome)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p className="truncate">{membro.membro_email}</p>
                      {membro.membro_telefone && (
                        <p className="truncate">{membro.membro_telefone}</p>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-1">
                        {membro.membro_tipo === 'Administrador' ? (
                          <Crown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                        <span className="text-xs font-medium text-foreground">
                          {membro.membro_tipo === 'Administrador' ? 'Administrador' : 'Usuário'}
                        </span>
                      </div>
                      
                      {membro.membro_status === 'Desativado' && (
                        <Badge variant="outline" className="text-xs font-normal bg-background/60">
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
            <DialogContent className="sm:max-w-[640px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Novo Membro</DialogTitle>
            <DialogDescription>
              Preencha as informações do novo membro da equipe
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
                Dados do membro
              </div>
              <div className="mt-4 grid gap-3">
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Nome completo</div>
                  <Input
                    id="nome"
                    type="text"
                    value={formData.nome}
                    onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: Rodrigo Henrique"
                    required
                    className="bg-background border-border rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">E-mail</div>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Ex: nome@empresa.com"
                    required
                    className="bg-background border-border rounded-2xl"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Telefone</div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        +55
                      </span>
                      <Input
                        id="telefone"
                        type="tel"
                        inputMode="numeric"
                        value={formatAddMemberPhone(formData.telefone)}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: normalizeAddMemberPhone(e.target.value) }))}
                        placeholder="(12) 99598-9598"
                        required
                        className="bg-background border-border rounded-2xl pl-12"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground">Senha</div>
                    <div className="relative">
                      <Input
                        id="senha"
                        type={showNewMemberPassword ? 'text' : 'password'}
                        value={formData.senha}
                        onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                        placeholder="Crie uma senha"
                        required
                        className="bg-background border-border rounded-2xl pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-xl"
                        onClick={() => setShowNewMemberPassword((prev) => !prev)}
                      >
                        {showNewMemberPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  setShowNewMemberPassword(false);
                }}
                disabled={isLoading}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading}
                variant="secondary"
                className="rounded-xl"
              >
                {isLoading ? 'Adicionando...' : 'Adicionar Membro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editMemberOpen}
        onOpenChange={(open) => {
          setEditMemberOpen(open);
          if (!open) {
            setEditingMember(null);
            setSavingMemberEdit(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar membro</DialogTitle>
            <DialogDescription>Edite apenas nome e telefone do membro.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEditMember} className="grid gap-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Nome</div>
              <Input
                value={editMemberForm.nome}
                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, nome: e.target.value }))}
                className="bg-background border-border rounded-2xl"
                placeholder="Nome do membro"
                disabled={savingMemberEdit}
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Telefone</div>
              <Input
                value={editMemberForm.telefone}
                onChange={(e) => setEditMemberForm((prev) => ({ ...prev, telefone: normalizePhone(e.target.value) }))}
                className="bg-background border-border rounded-2xl"
                placeholder="Telefone do membro"
                disabled={savingMemberEdit}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditMemberOpen(false)}
                disabled={savingMemberEdit}
                className="rounded-xl"
              >
                Cancelar
              </Button>
              <Button type="submit" variant="secondary" disabled={savingMemberEdit} className="rounded-xl">
                {savingMemberEdit ? 'Salvando...' : 'Salvar'}
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
              className="rounded-xl"
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
              className="rounded-xl"
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
