import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/contexts/CRMContext';
import { User, Mail, Phone, Building, Crown, Hash } from 'lucide-react';

const Settings = () => {
  const { user } = useCRM();

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

  const getPlanoBadge = (plano: number | null) => {
    if (plano === null || plano === undefined) {
      return <Badge variant="outline">Não definido</Badge>;
    }
    
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">
        {plano} Lead{plano !== 1 ? 's' : ''}
      </Badge>
    );
  };

  return (
    <div className="text-foreground transition-colors">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-primary light-title mb-8">Configurações</h1>
        
        <div className="w-full">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">Perfil do Usuário</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
            {/* Avatar e Nome */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                 <AvatarImage src={user.avatar || undefined} alt={user.nome} />
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

            {/* Informações do Usuário */}
            <div className="grid gap-4">
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
        </div>
      </div>
    </div>
  );
};

export default Settings;