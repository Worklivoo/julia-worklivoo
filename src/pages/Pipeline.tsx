
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useCRM } from '@/contexts/CRMContext';
import Header from '@/components/Header';
import KanbanBoard from '@/components/KanbanBoard';
import { Search, Plus, Filter, List, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';

const Pipeline = () => {
  const { leads, addLead } = useCRM();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);

  const [newLead, setNewLead] = useState({
    opportunityName: '',
    leadName: '',
    email: '',
    phone: '',
    value: 0,
    source: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    expectedCloseDate: ''
  });

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.opportunityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.leadName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    
    return matchesSearch && matchesStage && matchesPriority && matchesSource;
  });

  const handleAddLead = () => {
    if (newLead.opportunityName && newLead.leadName && newLead.email) {
      addLead({
        ...newLead,
        stage: 'lead',
        status: 'active',
        expectedCloseDate: newLead.expectedCloseDate ? new Date(newLead.expectedCloseDate) : undefined
      });
      setNewLead({
        opportunityName: '',
        leadName: '',
        email: '',
        phone: '',
        value: 0,
        source: '',
        priority: 'medium',
        expectedCloseDate: ''
      });
      setShowNewLeadDialog(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const stages = [
    { value: 'lead', label: 'Lead' },
    { value: 'qualified', label: 'Qualificado' },
    { value: 'proposal', label: 'Proposta' },
    { value: 'negotiation', label: 'Negociação' },
    { value: 'closed-won', label: 'Fechado' },
    { value: 'closed-lost', label: 'Perdido' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Pipeline</h1>
            <p className="text-muted-foreground mt-2">Gerencie suas oportunidades de vendas</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid size={16} className="mr-2" />
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List size={16} className="mr-2" />
              Lista
            </Button>
            
            <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground">
                  <Plus size={16} className="mr-2" />
                  Novo Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Adicionar Novo Lead</DialogTitle>
                  <DialogDescription>
                    Preencha as informações da nova oportunidade
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Nome da Oportunidade"
                    value={newLead.opportunityName}
                    onChange={(e) => setNewLead({...newLead, opportunityName: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Input
                    placeholder="Nome do Lead"
                    value={newLead.leadName}
                    onChange={(e) => setNewLead({...newLead, leadName: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Input
                    placeholder="E-mail"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Input
                    placeholder="Telefone"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Input
                    placeholder="Valor da Oportunidade"
                    type="number"
                    value={newLead.value}
                    onChange={(e) => setNewLead({...newLead, value: Number(e.target.value)})}
                    className="bg-background border-border"
                  />
                  <Input
                    placeholder="Fonte/Canal"
                    value={newLead.source}
                    onChange={(e) => setNewLead({...newLead, source: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Select value={newLead.priority} onValueChange={(value: 'low' | 'medium' | 'high') => setNewLead({...newLead, priority: value})}>
                    <SelectTrigger className="bg-background border-border">
                      <SelectValue placeholder="Prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Data Esperada de Fechamento"
                    type="date"
                    value={newLead.expectedCloseDate}
                    onChange={(e) => setNewLead({...newLead, expectedCloseDate: e.target.value})}
                    className="bg-background border-border"
                  />
                  <Button onClick={handleAddLead} className="w-full">
                    Criar Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtros */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar oportunidades..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-background border-border"
                />
              </div>
              
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[150px] bg-background border-border">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as etapas</SelectItem>
                  {stages.map(stage => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] bg-background border-border">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[130px] bg-background border-border">
                  <SelectValue placeholder="Fonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Website">Website</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Referência">Referência</SelectItem>
                </SelectContent>
              </Select>

              {(searchTerm || stageFilter !== 'all' || priorityFilter !== 'all' || sourceFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setStageFilter('all');
                    setPriorityFilter('all');
                    setSourceFilter('all');
                  }}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conteúdo do Pipeline */}
        {viewMode === 'kanban' ? (
          <KanbanBoard />
        ) : (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Lista de Oportunidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex-1">
                      <Link to={`/lead/${lead.id}`} className="block">
                        <h4 className="font-medium text-primary hover:underline">{lead.opportunityName}</h4>
                        <p className="text-sm text-muted-foreground">{lead.leadName} • {lead.email}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="secondary">{stages.find(s => s.value === lead.stage)?.label}</Badge>
                          <Badge variant={lead.priority === 'high' ? 'destructive' : lead.priority === 'medium' ? 'default' : 'secondary'}>
                            {lead.priority === 'high' ? 'Alta' : lead.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{lead.source}</span>
                        </div>
                      </Link>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-400">{formatCurrency(lead.value)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))}
                
                {filteredLeads.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma oportunidade encontrada com os filtros aplicados.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Pipeline;
