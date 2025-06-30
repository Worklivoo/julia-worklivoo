
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/contexts/CRMContext';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Target, Award } from 'lucide-react';

const Reports = () => {
  const { leads, getDashboardMetrics } = useCRM();
  const [timeFilter, setTimeFilter] = useState('30');
  const [stageFilter, setStageFilter] = useState('all');
  const metrics = getDashboardMetrics();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Dados para gráficos
  const conversionFunnelData = [
    { stage: 'Leads', count: leads.filter(l => l.stage === 'lead').length, percentage: 100 },
    { stage: 'Qualificados', count: leads.filter(l => l.stage === 'qualified').length, percentage: 0 },
    { stage: 'Propostas', count: leads.filter(l => l.stage === 'proposal').length, percentage: 0 },
    { stage: 'Negociação', count: leads.filter(l => l.stage === 'negotiation').length, percentage: 0 },
    { stage: 'Fechados', count: leads.filter(l => l.stage === 'closed-won').length, percentage: 0 },
  ];

  // Calcular percentuais do funil
  if (conversionFunnelData[0].count > 0) {
    conversionFunnelData.forEach((item, index) => {
      if (index > 0) {
        item.percentage = (item.count / conversionFunnelData[0].count) * 100;
      }
    });
  }

  const sourcePerformanceData = [
    { source: 'Website', leads: leads.filter(l => l.source === 'Website').length, value: leads.filter(l => l.source === 'Website').reduce((sum, l) => sum + l.value, 0) },
    { source: 'LinkedIn', leads: leads.filter(l => l.source === 'LinkedIn').length, value: leads.filter(l => l.source === 'LinkedIn').reduce((sum, l) => sum + l.value, 0) },
    { source: 'Referência', leads: leads.filter(l => l.source === 'Referência').length, value: leads.filter(l => l.source === 'Referência').reduce((sum, l) => sum + l.value, 0) },
  ];

  const monthlyTrendData = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthLeads = leads.filter(lead => {
      const leadDate = new Date(lead.createdAt);
      return leadDate.getMonth() === date.getMonth() && leadDate.getFullYear() === date.getFullYear();
    });
    
    monthlyTrendData.push({
      month: date.toLocaleDateString('pt-BR', { month: 'short' }),
      leads: monthLeads.length,
      value: monthLeads.reduce((sum, lead) => sum + lead.value, 0),
      won: monthLeads.filter(l => l.status === 'won').length
    });
  }

  const priorityDistribution = [
    { name: 'Alta', value: leads.filter(l => l.priority === 'high').length, color: '#ef4444' },
    { name: 'Média', value: leads.filter(l => l.priority === 'medium').length, color: '#f59e0b' },
    { name: 'Baixa', value: leads.filter(l => l.priority === 'low').length, color: '#10b981' },
  ];

  const topLeads = leads
    .filter(l => l.status === 'active')
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Relatórios</h1>
            <p className="text-muted-foreground mt-2">Análise detalhada do desempenho de vendas</p>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={timeFilter} onValueChange={setTimeFilter}>
              <SelectTrigger className="w-[140px] bg-background border-border">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" className="border-border">
              <Calendar size={16} className="mr-2" />
              Exportar
            </Button>
          </div>
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Pipeline Total</CardDescription>
                <TrendingUp size={16} className="text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-400">{formatCurrency(metrics.pipelineValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {metrics.totalLeads} oportunidades ativas
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Taxa de Conversão</CardDescription>
                <Target size={16} className="text-blue-400" />
              </div>
              <CardTitle className="text-2xl text-blue-400">{metrics.conversionRate.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {metrics.wonDeals} de {metrics.totalLeads} convertidos
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Ticket Médio</CardDescription>
                <Award size={16} className="text-purple-400" />
              </div>
              <CardTitle className="text-2xl text-purple-400">{formatCurrency(metrics.avgDealSize)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Valor médio por deal
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription>Crescimento Mensal</CardDescription>
                <TrendingUp size={16} className="text-green-400" />
              </div>
              <CardTitle className="text-2xl text-green-400">+{metrics.leadsThisMonth}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Novos leads este mês
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Funil de Conversão</CardTitle>
              <CardDescription>Taxa de conversão por etapa</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conversionFunnelData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis dataKey="stage" type="category" stroke="#9CA3AF" fontSize={12} width={80} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                    formatter={(value, name) => [
                      name === 'count' ? `${value} leads` : `${Number(value).toFixed(1)}%`,
                      name === 'count' ? 'Quantidade' : 'Taxa de Conversão'
                    ]}
                  />
                  <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Tendência Mensal</CardTitle>
              <CardDescription>Evolução de leads e vendas</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="leads" 
                    stackId="1"
                    stroke="#6366f1" 
                    fill="#6366f1" 
                    fillOpacity={0.3}
                    name="Leads"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="won" 
                    stackId="2"
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.5}
                    name="Vendas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Seção de análises detalhadas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Performance por Fonte</CardTitle>
              <CardDescription>Eficácia dos canais de aquisição</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sourcePerformanceData.map((source) => (
                  <div key={source.source} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div>
                      <h4 className="font-medium text-primary">{source.source}</h4>
                      <p className="text-sm text-muted-foreground">{source.leads} leads</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-400">{formatCurrency(source.value)}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.leads > 0 ? formatCurrency(source.value / source.leads) : 'R$ 0'} /lead
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Distribuição de Prioridade</CardTitle>
              <CardDescription>Segmentação por prioridade</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={priorityDistribution}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {priorityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Top 5 Oportunidades</CardTitle>
              <CardDescription>Maiores deals em aberto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topLeads.map((lead, index) => (
                  <div key={lead.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary" className="w-6 h-6 rounded-full p-0 flex items-center justify-center text-xs">
                        {index + 1}
                      </Badge>
                      <div>
                        <h4 className="font-medium text-primary text-sm">{lead.opportunityName}</h4>
                        <p className="text-xs text-muted-foreground">{lead.leadName}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-400 text-sm">{formatCurrency(lead.value)}</p>
                      <p className="text-xs text-muted-foreground">{lead.stage}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Insights automáticos */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Insights Inteligentes</CardTitle>
            <CardDescription>Análises automáticas baseado nos seus dados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 border border-green-500/20 bg-green-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-green-400" />
                  <span className="text-sm font-medium text-green-400">Insight Positivo</span>
                </div>
                <p className="text-sm">
                  Sua taxa de conversão está {metrics.conversionRate > 20 ? 'acima' : 'dentro'} da média do mercado.
                  {metrics.conversionRate > 30 && ' Excelente trabalho!'}
                </p>
              </div>

              <div className="p-4 border border-blue-500/20 bg-blue-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target size={16} className="text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">Oportunidade</span>
                </div>
                <p className="text-sm">
                  Você tem {leads.filter(l => l.stage === 'negotiation').length} deals em negociação. 
                  Foque neles para acelerar o fechamento.
                </p>
              </div>

              <div className="p-4 border border-yellow-500/20 bg-yellow-500/5 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Award size={16} className="text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Recomendação</span>
                </div>
                <p className="text-sm">
                  {sourcePerformanceData.length > 0 && 
                    `${sourcePerformanceData.reduce((best, current) => 
                      current.value > best.value ? current : best
                    ).source} é sua melhor fonte. Invista mais nesse canal.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Reports;
