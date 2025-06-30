
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useCRM } from '@/contexts/CRMContext';
import Header from '@/components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Dashboard = () => {
  const { leads, getDashboardMetrics } = useCRM();
  const metrics = getDashboardMetrics();

  const stageData = [
    { name: 'Lead', value: leads.filter(l => l.stage === 'lead').length },
    { name: 'Qualificado', value: leads.filter(l => l.stage === 'qualified').length },
    { name: 'Proposta', value: leads.filter(l => l.stage === 'proposal').length },
    { name: 'Negociação', value: leads.filter(l => l.stage === 'negotiation').length },
    { name: 'Fechado', value: leads.filter(l => l.stage === 'closed-won').length },
  ];

  const sourceData = [
    { name: 'Website', value: leads.filter(l => l.source === 'Website').length },
    { name: 'LinkedIn', value: leads.filter(l => l.source === 'LinkedIn').length },
    { name: 'Referência', value: leads.filter(l => l.source === 'Referência').length },
    { name: 'Outros', value: leads.filter(l => !['Website', 'LinkedIn', 'Referência'].includes(l.source)).length },
  ];

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00'];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Visão geral do seu pipeline de vendas</p>
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription>Total de Leads</CardDescription>
              <CardTitle className="text-3xl text-primary">{metrics.totalLeads}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {metrics.leadsThisMonth} novos este mês
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription>Valor do Pipeline</CardDescription>
              <CardTitle className="text-3xl text-green-400">{formatCurrency(metrics.pipelineValue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                Ticket médio: {formatCurrency(metrics.avgDealSize)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription>Taxa de Conversão</CardDescription>
              <CardTitle className="text-3xl text-primary">{metrics.conversionRate.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={metrics.conversionRate} className="h-2" />
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardDescription>Negócios Fechados</CardDescription>
              <CardTitle className="text-3xl text-primary">{metrics.wonDeals}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {metrics.lostDeals} perdidos
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Leads por Etapa</CardTitle>
              <CardDescription>Distribuição atual do pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '6px'
                    }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Origem dos Leads</CardTitle>
              <CardDescription>Canais de aquisição</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
        </div>

        {/* Atividade recente */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Leads Recentes</CardTitle>
            <CardDescription>Últimas oportunidades criadas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                  <div>
                    <h4 className="font-medium text-primary">{lead.opportunityName}</h4>
                    <p className="text-sm text-muted-foreground">{lead.leadName} • {lead.source}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-green-400">{formatCurrency(lead.value)}</p>
                    <p className="text-xs text-muted-foreground">{lead.stage}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
