import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Membro, getMembrosByUser, createUserAndAddMembro } from '@/lib/membros';
// Importando os componentes de UI
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserCircle, Plus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
    senha: '',
    cargo: '' as 'Administrador' | 'Usuario' | ''
  });

  // Carregar membros
  useEffect(() => {
    const fetchMembros = async () => {
      if (!user) return;
      
      setLoading(true);
      
      try {
        // Determinar qual user_id usar para buscar os membros
        // Se for membro, usa o user_id_empresa, senão usa o próprio id
        const userIdForMembers = user.isMembro ? user.user_id_empresa : user.id;
        
        if (!userIdForMembers) {
          setMembros([]);
          return;
        }
        
        // Buscar todos os membros da empresa
        const { data, error } = await getMembrosByUser(userIdForMembers);
        
        if (error) {
          console.error('Erro ao buscar membros:', error);
          setMembros([]);
          return;
        }
        
        // Definir os membros (pode ser array vazio)
        setMembros(data || []);
      } catch (error) {
        console.error('Erro ao carregar membros:', error);
        setMembros([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMembros();
  }, [user]);



  // Função para obter as iniciais do nome
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Função para obter cor de fundo baseada no nome
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ];
    const index = name.length % colors.length;
    return colors[index];
  };

  // Função para verificar se o usuário pode adicionar membros
  const canAddMembers = () => {
    if (!user) return false;
    // Usuário não é membro (está na página de "usuarios") OU é membro com cargo de "Administrador"
    return !user.isMembro || (user.isMembro && user.membro_cargo === 'Administrador');
  };

  // Função para lidar com mudanças no formulário
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Função para resetar o formulário
  const resetForm = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      cargo: ''
    });
  };

  // Função para lidar com o envio do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.nome || !formData.email || !formData.senha || !formData.cargo) {
      setMessage({ type: 'error', text: 'Todos os campos são obrigatórios' });
      return;
    }

    if (formData.senha.length < 6) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 6 caracteres' });
      return;
    }

    setIsLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const representedUserId = getRepresentedUserId();
      console.log('Dados sendo enviados:', {
        email: formData.email,
        nome: formData.nome,
        cargo: formData.cargo,
        representedUserId
      });
      
      const result = await createUserAndAddMembro(
        formData.email,
        formData.senha,
        formData.nome,
        formData.cargo as 'Administrador' | 'Usuario',
        'Ativo',
        representedUserId
      );

      console.log('Resultado completo:', result);

      if (result.error) {
        console.error('Erro detalhado:', result.error);
        setMessage({ type: 'error', text: 'Erro ao criar membro: ' + (result.error.message || JSON.stringify(result.error)) });
      } else {
        console.log('Membro criado com sucesso:', result.data);
        setMessage({ type: 'success', text: 'Membro criado com sucesso' });
        setTimeout(() => {
          setIsDialogOpen(false);
          resetForm();
          setMessage({ type: '', text: '' });
          // Recarregar a lista de membros
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Exceção capturada:', error);
      setMessage({ type: 'error', text: 'Erro inesperado ao criar membro: ' + (error instanceof Error ? error.message : 'Erro desconhecido') });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para obter o user_id que está sendo representado
  const getRepresentedUserId = () => {
    if (!user) return null;
    // Se for membro, usa o user_id_empresa, senão usa o próprio id
    return user.isMembro ? user.user_id_empresa : user.id;
  };

  // Função para abrir o modal
  const handleAddMember = () => {
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold dark:bg-gradient-to-r dark:from-primary dark:to-primary/80 dark:bg-clip-text dark:text-transparent">
              Membros da {user?.empresa || "Empresa"}
            </h1>
            <p className="text-muted-foreground mt-1">Gerencie os membros da sua equipe</p>
          </div>
          {canAddMembers() && (
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleAddMember}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Membro
            </Button>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <p className="text-lg text-muted-foreground">Carregando membros...</p>
        </div>
      ) : membros.length === 0 ? (
        <div className="flex flex-col justify-center items-center h-64 bg-card rounded-2xl border border-border p-6">
          <UserCircle className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">Nenhum membro encontrado</h3>
          <p className="text-muted-foreground text-center max-w-md">Adicione membros à sua equipe para começar a colaborar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {membros.map((membro) => (
            <Card 
              key={membro.membro_id} 
              className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-[1.02] overflow-hidden"
            >
              <CardContent className="p-6">
                <div className="flex flex-col items-center text-center">
                  <Avatar className={`h-16 w-16 mb-4 ${getAvatarColor(membro.membro_nome)}`}>
                    <AvatarFallback className="text-lg font-semibold">{getInitials(membro.membro_nome)}</AvatarFallback>
                  </Avatar>
                  <h3 className="text-lg font-semibold text-foreground">{membro.membro_nome}</h3>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal de Adicionar Membro */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
             <DialogTitle>Adicionar Novo Membro</DialogTitle>
             <DialogDescription>
               Preencha os dados do novo membro da equipe.
               <br />
               <span className="text-xs text-muted-foreground mt-2 block">
                 Empresa: <span className="font-mono font-medium">{getRepresentedUserId()}</span>
               </span>
               {message.text && (
                 <div className={`mt-3 p-3 rounded-md text-sm ${
                   message.type === 'success' 
                     ? 'bg-green-50 text-green-700 border border-green-200' 
                     : 'bg-red-50 text-red-700 border border-red-200'
                 }`}>
                   {message.text}
                 </div>
               )}
             </DialogDescription>
           </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  type="text"
                  placeholder="Digite o nome completo"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite o e-mail"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Digite a senha"
                  value={formData.senha}
                  onChange={(e) => handleInputChange('senha', e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cargo">Cargo</Label>
                <Select
                  value={formData.cargo}
                  onValueChange={(value) => handleInputChange('cargo', value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Usuario">Usuário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Criando...' : 'Adicionar Membro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default Membros;