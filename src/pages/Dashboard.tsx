import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { TooltipProvider } from '@/components/ui/tooltip';

import { useCRM } from '@/contexts/CRMContext';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { useIsMobile } from '@/hooks/use-mobile';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Target, Activity, ArrowUpRight, ArrowDownRight, BarChart3, Globe, Clock } from 'lucide-react';

const Dashboard = () => {
  const { leads, getDashboardMetrics, user } = useCRM();
  const { getTopOrigins } = useLeadOrigins();
  const isMobile = useIsMobile();
  const metrics = getDashboardMetrics();

  // Memoizar data atual para evitar recálculos constantes
  const now = useMemo(() => new Date(), []);

  // Memoizar dados dos gráficos para evitar recálculos desnecessários
  const stageData = useMemo(() => [
    { name: 'Entrada Lead', value: leads.filter(l => l.stage === 'entrada').length },
    { name: 'Tentando Contato', value: leads.filter(l => l.stage === 'tentando-contato').length },
    { name: 'Contato Realizado', value: leads.filter(l => l.stage === 'contato-realizado').length },
    { name: 'Oport. Qualificada', value: leads.filter(l => l.stage === 'qualificada').length },
  ], [leads]);

  // Memoizar origens dos leads
  const topOrigins = useMemo(() => getTopOrigins(5), [getTopOrigins]);
  
  // Memoizar dados de origem
  const sourceData = useMemo(() => {
    return topOrigins.length > 0 
      ? topOrigins.map(origin => ({
          name: origin.name,
          value: origin.count
        }))
      : [
          { name: 'Sem origem definida', value: leads.filter(l => !l.source || l.source.trim() === '').length }
        ];
  }, [topOrigins, leads]);

  // Memoizar cálculos de leads do mês
  const leadsDoMes = useMemo(() => {
    const leadsNoMes = leads.filter(l => {
      const d = new Date(l.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const leadsAbertosNoMes = leadsNoMes.filter(l => l.status === 'active');
    const leadsQualificadosNoMes = leadsNoMes.filter(l => l.stage === 'qualificada');
    const taxaConversaoQualificados = leadsNoMes.length > 0 ? (leadsQualificadosNoMes.length / leadsNoMes.length) * 100 : 0;

    return {
      leadsNoMes,
      leadsAbertosNoMes,
      leadsQualificadosNoMes,
      taxaConversaoQualificados
    };
  }, [leads, now]);

  // Memoizar conversão por etapa
  const conversaoPorEtapa = useMemo(() => {
    const etapas = [
      { id: 'entrada', nome: 'Entrada Lead' },
      { id: 'contato-realizado', nome: 'Contato Realizado' },
      { id: 'qualificada', nome: 'Oport. Qualificada' },
    ];
    const totalPorEtapa = etapas.map(etapa => leadsDoMes.leadsNoMes.filter(l => l.stage === etapa.id).length);
    return etapas.map((etapa, idx) => {
      if (idx === 0) return { etapa: etapa.nome, conversao: 100 };
      const anterior = totalPorEtapa[idx - 1];
      const atual = totalPorEtapa[idx];
      return {
        etapa: etapa.nome,
        conversao: anterior > 0 ? (atual / anterior) * 100 : 0
      };
    });
  }, [leadsDoMes]);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 p-6">
        {/* Header com Avatar e Informações */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent light-welcome-title">
              Bem-vindo, {user?.nome || 'Usuário'}!
            </h1>
            <p className="text-muted-foreground mt-1 text-lg">Resultados gerais da Julia</p>
            <Badge variant="secondary" className="mt-2 rounded-full">
              <Activity className="w-3 h-3 mr-1" />
              Dashboard Atualizado
            </Badge>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-sm text-muted-foreground">Última atualização</p>
            <p className="text-lg font-semibold">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
        
        <Separator className="my-8" />

        {/* Métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card do Plano de Leads */}
              <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">Plano de Leads</CardDescription>
                    <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                      <Activity className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                    {leadsDoMes.leadsNoMes.length}/{user?.plano || 500}
                    {leadsDoMes.leadsNoMes.length <= (user?.plano || 500) ? 
                      <ArrowUpRight className="w-4 h-4 text-green-500" /> : 
                      <ArrowDownRight className="w-4 h-4 text-red-500" />
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Progress 
                      value={Math.min((leadsDoMes.leadsNoMes.length / (user?.plano || 500)) * 100, 100)} 
                      className="h-2"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{Math.round((leadsDoMes.leadsNoMes.length / (user?.plano || 500)) * 100)}% usado</span>
                      <span>{Math.max(0, (user?.plano || 500) - leadsDoMes.leadsNoMes.length)} restantes</span>
                    </div>
                    {leadsDoMes.leadsNoMes.length > (user?.plano || 500) && (
                      <Badge variant="destructive" className="rounded-full text-xs">
                        +{leadsDoMes.leadsNoMes.length - (user?.plano || 500)} excedentes
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">Total de Leads em Aberto</CardDescription>
                    <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                  <Users className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-4xl font-bold text-foreground flex items-center gap-2">
                    {leadsDoMes.leadsAbertosNoMes.length}
                    <ArrowUpRight className="w-5 h-5 text-green-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full text-xs">
                      +{leadsDoMes.leadsAbertosNoMes.length} este mês
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">Oportunidades Qualificadas</CardDescription>
                    <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                      <Target className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-4xl font-bold text-foreground flex items-center gap-2">
                    {leadsDoMes.leadsQualificadosNoMes.length}
                    <TrendingUp className="w-5 h-5 text-foreground" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-full text-xs">
                      {leadsDoMes.leadsNoMes.length} leads no mês
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105 cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription className="text-sm font-medium">Taxa de Conversão</CardDescription>
                    <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                      <TrendingUp className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-4xl font-bold text-foreground flex items-center gap-2">
                    {leadsDoMes.taxaConversaoQualificados.toFixed(1)}%
                    {leadsDoMes.taxaConversaoQualificados > 20 ? 
                      <ArrowUpRight className="w-5 h-5 text-green-500" /> : 
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress value={leadsDoMes.taxaConversaoQualificados} className="h-3 rounded-full" />
                </CardContent>
              </Card>


        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 gap-8">
          {/* Funil de Leads - Desktop: Gráfico, Mobile: Cards */}
          {isMobile ? (
            <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Funil de Leads</CardTitle>
                    <CardDescription className="text-sm">Distribuição atual do funil de vendas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {stageData.map((stage, index) => {
                    const stageNames = {
                      'Entrada Lead': 'Entrada',
                      'Tentando Contato': 'Contato',
                      'Contato Realizado': 'Realizado',
                      'Oport. Qualificada': 'Qualificada'
                    };
                    const colors = ['bg-primary', 'bg-muted', 'bg-accent', 'bg-secondary'];
                    return (
                      <div key={stage.name} className="bg-muted/30 rounded-xl p-4 text-center">
                        <div className={`w-12 h-12 ${colors[index]} rounded-full flex items-center justify-center mx-auto mb-2`}>
                           <span className="text-primary-foreground font-bold text-lg">{stage.value}</span>
                         </div>
                        <p className="text-sm font-medium text-foreground">{stageNames[stage.name] || stage.name}</p>
                        <p className="text-xs text-muted-foreground">leads</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                    <BarChart3 className="w-6 h-6 text-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Funil de Leads</CardTitle>
                    <CardDescription className="text-sm">Distribuição atual do funil de vendas</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={stageData} margin={{ top: 20, right: 30, left: 5, bottom: 40 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        tick={{ fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        tick={{ fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-popover-foreground">{label}</p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-bold text-primary">{payload[0].value}</span> leads
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#EBF57D" 
                        radius={[8, 8, 0, 0]} 
                        className="hover:opacity-80 transition-opacity"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Origem dos Leads - Desktop: Gráfico, Mobile: Cards */}
          {isMobile ? (
            <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl shadow-lg">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                     <TrendingUp className="w-6 h-6 text-foreground" />
                   </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Origem dos Leads</CardTitle>
                    <CardDescription className="text-sm">Principais canais de aquisição</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                   {sourceData.map((origin, index) => {
                     const gradients = [
                        'bg-primary',
                        'bg-muted', 
                        'bg-accent',
                        'bg-secondary',
                        'bg-border'
                      ];
                     return (
                       <div key={origin.name} className="bg-muted/30 rounded-xl p-4">
                         <div className="flex items-center justify-between">
                           <div className="flex items-center gap-3">
                             <div className={`w-4 h-8 ${gradients[index]} rounded-lg`}></div>
                             <div>
                               <p className="font-medium text-foreground">{origin.name}</p>
                               <p className="text-xs text-muted-foreground">Canal de origem</p>
                             </div>
                           </div>
                           <div className="text-right">
                             <p className="text-2xl font-bold text-foreground">{origin.value}</p>
                             <p className="text-xs text-muted-foreground">leads</p>
                           </div>
                         </div>
                       </div>
                     );
                   })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                     <TrendingUp className="w-6 h-6 text-foreground" />
                   </div>
                  <div>
                    <CardTitle className="text-xl font-bold">Origem dos Leads</CardTitle>
                    <CardDescription className="text-sm">Principais canais de aquisição</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/30 rounded-xl p-4">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={sourceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                      <XAxis 
                        dataKey="name" 
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        tick={{ fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={11} 
                        tick={{ fill: '#9CA3AF' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium text-popover-foreground">{label}</p>
                                <p className="text-sm text-muted-foreground">
                                  <span className="font-bold text-primary">{payload[0].value}</span> leads
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#EBF57D" 
                        radius={[8, 8, 0, 0]} 
                        className="hover:opacity-80 transition-opacity"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Atividade recente */}
        <Card className="bg-gradient-to-br from-card to-card/50 border-border rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#EBF57D]/20 rounded-xl">
                <Clock className="w-6 h-6 text-foreground" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Leads Recentes</CardTitle>
                <CardDescription className="text-sm">Últimas oportunidades criadas no sistema</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leadsDoMes.leadsAbertosNoMes
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5)
                .map((lead, index) => {
                  
                  return (
                    <div key={lead.id} className={`group ${isMobile ? 'p-3' : 'p-4'} bg-muted/30 border border-border/50 rounded-xl hover:bg-muted/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md`}>
                      {isMobile ? (
                         // Versão Mobile Simplificada
                         <div className="flex items-center gap-3">
                           <Avatar className="h-8 w-8 flex-shrink-0">
                             <AvatarFallback className="text-xs font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                               {lead.leadName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                             </AvatarFallback>
                           </Avatar>
                           <div className="flex-1 min-w-0">
                             <h4 className="font-medium text-foreground text-sm leading-relaxed break-words">
                               {lead.opportunityName}
                             </h4>
                           </div>
                         </div>
                      ) : (
                        // Versão Desktop Original
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-10 w-10 flex-shrink-0">
                              <AvatarFallback className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-sm font-semibold" style={{backgroundColor: '#EBF57D', color: '#000000'}}>
                                {lead.leadName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                {lead.opportunityName}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-muted-foreground">{lead.leadName}</p>
                                <Separator orientation="vertical" className="h-3" />
                                <Badge variant="outline" className="text-xs rounded-full">
                                  {lead.source || 'Sem origem'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-sm font-medium text-foreground">
                                {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              
              {leadsDoMes.leadsAbertosNoMes.length === 0 && (
                <div className="text-center py-8">
                  <div className="p-4 bg-muted/30 rounded-xl">
                    <Users className="w-12 h-12 text-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">Nenhum lead encontrado este mês</p>
                    <p className="text-sm text-muted-foreground mt-1">Novos leads aparecerão aqui quando criados</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
};

export default Dashboard;
