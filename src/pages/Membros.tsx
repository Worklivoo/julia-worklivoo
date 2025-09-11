import React, { useState, useEffect } from 'react';
import { useCRM } from '@/contexts/CRMContext';
import { Membro, getMembrosByUser } from '@/lib/membros';
// Importando os componentes de UI
import { Card, CardContent } from '@/components/ui/card';
import { UserCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function Membros() {
  const { user } = useCRM();
  const [membros, setMembros] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <div>
          <h1 className="text-4xl font-bold dark:bg-gradient-to-r dark:from-primary dark:to-primary/80 dark:bg-clip-text dark:text-transparent">
            Membros da {user?.empresa || "Empresa"}
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os membros da sua equipe</p>
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
    </div>
  );
}

export default Membros;