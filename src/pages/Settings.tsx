import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCRM } from '@/contexts/CRMContext';
import { usePersistentTab, usePersistentState } from '@/hooks/use-persistent-state';
import { User, Mail, Phone, Building, Crown, Hash, Settings as SettingsIcon, Shield, Bell } from 'lucide-react';

const Settings = () => {
  const { user } = useCRM();
  const [activeTab, setActiveTab] = usePersistentTab('settings', 'profile');
  const [notifications, setNotifications] = usePersistentState('settings-notifications', {
    email: true,
    push: false,
    marketing: false
  });
  const [preferences, setPreferences] = usePersistentState('settings-preferences', {
    theme: 'light',
    language: 'pt-BR',
    autoSave: true
  });

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
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Preferências
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
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
          </TabsContent>

          <TabsContent value="preferences">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">Preferências do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Notificações por Email</Label>
                      <p className="text-sm text-muted-foreground">Receber notificações importantes por email</p>
                    </div>
                    <Switch 
                      checked={notifications.email} 
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Notificações Push</Label>
                      <p className="text-sm text-muted-foreground">Receber notificações push no navegador</p>
                    </div>
                    <Switch 
                      checked={notifications.push} 
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: checked }))}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base">Auto-salvar</Label>
                      <p className="text-sm text-muted-foreground">Salvar automaticamente as alterações</p>
                    </div>
                    <Switch 
                      checked={preferences.autoSave} 
                      onCheckedChange={(checked) => setPreferences(prev => ({ ...prev, autoSave: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">Segurança da Conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="current-password" className="text-base">Senha Atual</Label>
                    <Input 
                      id="current-password" 
                      type="password" 
                      placeholder="Digite sua senha atual"
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="new-password" className="text-base">Nova Senha</Label>
                    <Input 
                      id="new-password" 
                      type="password" 
                      placeholder="Digite sua nova senha"
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="confirm-password" className="text-base">Confirmar Nova Senha</Label>
                    <Input 
                      id="confirm-password" 
                      type="password" 
                      placeholder="Confirme sua nova senha"
                      className="mt-2"
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline">Cancelar</Button>
                    <Button>Alterar Senha</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;