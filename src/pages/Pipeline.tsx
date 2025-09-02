import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DateRange, DateRangePicker } from "@/components/DateRangePicker";
import { startOfMonth, endOfMonth } from "date-fns";
import { useCRM } from '@/contexts/CRMContext';
import { usePersistentDateRange } from '@/hooks/use-persistent-state';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { useIsMobile } from '@/hooks/use-mobile';
import KanbanBoard from '@/components/KanbanBoard';
import { Search, Plus, Filter, Activity } from 'lucide-react';

const Pipeline = () => {
  const { leads, addLead, user } = useCRM();
  const { origins } = useLeadOrigins();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [dateRange, setDateRange] = usePersistentDateRange(
    'pipeline-date-range',
    {
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date())
    }
  );
  const [showNewLeadDialog, setShowNewLeadDialog] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [addLeadLoading, setAddLeadLoading] = useState(false);
  const [addLeadError, setAddLeadError] = useState<string | null>(null);
  const [addLeadSuccess, setAddLeadSuccess] = useState<string | null>(null);
  const [showOriginSuggestions, setShowOriginSuggestions] = useState(false);

  const [newLead, setNewLead] = useState({
    opportunityName: '',
    leadName: '',
    phone: '',
    company: '',
    source: '',
    notes: '',
    email: '',
  });

  // Filtrar origens baseado no que o usuário está digitando
  const filteredOrigins = origins.filter(origin => 
    origin.toLowerCase().includes(newLead.source.toLowerCase())
  );

  const handleOriginSelect = (origin: string) => {
    setNewLead({...newLead, source: origin});
    setShowOriginSuggestions(false);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.opportunityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.leadName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'open' && lead.status === 'active') ||
                         (statusFilter === 'lost' && lead.status === 'lost') ||
                         (statusFilter === 'won' && lead.status === 'won');
    
    // Filtro por período usando DateRange
    let matchesDate = true;
    if (dateRange.from && dateRange.to) {
      const createdAt = new Date(lead.createdAt);
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      // Ajustar para incluir o dia inteiro
      toDate.setHours(23, 59, 59, 999);
      matchesDate = createdAt >= fromDate && createdAt <= toDate;
    }
    
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleAddLead = async () => {
    setAddLeadError(null);
    setAddLeadSuccess(null);
    
    if (newLead.opportunityName && newLead.leadName && newLead.phone) {
      setAddLeadLoading(true);
      
      const leadData = {
        opportunityName: newLead.opportunityName,
        leadName: newLead.leadName,
        phone: newLead.phone,
        email: newLead.email,
        company: newLead.company,
        source: newLead.source,
        stage: 'entrada' as const,
        status: 'active' as const,
        value: 0,
        priority: 'medium' as const
      };
      
      const result = await addLead(leadData);
      setAddLeadLoading(false);
      
      if (result.success) {
        setAddLeadSuccess('Lead adicionado com sucesso!');
        setNewLead({
          opportunityName: '',
          leadName: '',
          phone: '',
          company: '',
          source: '',
          notes: '',
          email: '',
        });
        setShowNewLeadDialog(false);
      } else {
        setAddLeadError(result.error || 'Erro ao adicionar lead.');
      }
    } else {
      setAddLeadError('Preencha todos os campos obrigatórios.');
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-8 flex flex-col">
        {/* Modern Header */}
        <div className="bg-gradient-to-r from-card/50 to-muted/30 backdrop-blur-sm rounded-2xl border border-border/50 shadow-lg p-4">
          {isMobile ? (
            // Layout Mobile
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent light-gradient-black">
                  Funil de Leads
                </h1>
                <p className="text-muted-foreground mt-1 text-sm">
                  Gerencie seus leads e oportunidades de vendas
                </p>
              </div>
              
              <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full shadow-lg hover:shadow-xl transition-all duration-300" style={{backgroundColor: '#EBF57D', color: '#000000'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Lead</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do novo lead para adicionar ao funil.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="opportunityName" className="text-right text-sm font-medium">
                        Oportunidade *
                      </label>
                      <Input
                        id="opportunityName"
                        value={newLead.opportunityName}
                        onChange={(e) => setNewLead({...newLead, opportunityName: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome da oportunidade"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="leadName" className="text-right text-sm font-medium">
                        Nome *
                      </label>
                      <Input
                        id="leadName"
                        value={newLead.leadName}
                        onChange={(e) => setNewLead({...newLead, leadName: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome do lead"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="phone" className="text-right text-sm font-medium">
                        Telefone *
                      </label>
                      <Input
                        id="phone"
                        value={newLead.phone}
                        onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                        className="col-span-3"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="company" className="text-right text-sm font-medium">
                        Empresa
                      </label>
                      <Input
                        id="company"
                        value={newLead.company}
                        onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome da empresa"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 relative">
                      <label htmlFor="source" className="text-right text-sm font-medium">
                        Origem
                      </label>
                      <div className="col-span-3 relative">
                        <Input
                          id="source"
                          value={newLead.source}
                          onChange={(e) => {
                            setNewLead({...newLead, source: e.target.value});
                            setShowOriginSuggestions(e.target.value.length > 0);
                          }}
                          placeholder="Ex: Google Ads, Facebook, Indicação"
                        />
                        {showOriginSuggestions && filteredOrigins.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {filteredOrigins.map((origin, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                onClick={() => handleOriginSelect(origin)}
                              >
                                {origin}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="email" className="text-right text-sm font-medium">
                        E-mail
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={newLead.email}
                        onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                        className="col-span-3"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="notes" className="text-right text-sm font-medium">
                        Observações
                      </label>
                      <Input
                        id="notes"
                        value={newLead.notes}
                        onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                        className="col-span-3"
                        placeholder="Observações adicionais"
                      />
                    </div>
                    {addLeadError && (
                      <div className="text-red-500 text-sm mt-2">
                        {addLeadError}
                      </div>
                    )}
                    {addLeadSuccess && (
                      <div className="text-green-500 text-sm mt-2">
                        {addLeadSuccess}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddLead} 
                      disabled={addLeadLoading}
                      style={{backgroundColor: '#EBF57D', color: '#000000'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}
                    >
                      {addLeadLoading ? 'Adicionando...' : 'Adicionar Lead'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            // Layout Desktop
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent light-gradient-black">
                  Funil de Leads
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gerencie seus leads e oportunidades de vendas
                </p>
              </div>
              
              <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
                <DialogTrigger asChild>
                  <Button className="shadow-lg hover:shadow-xl transition-all duration-300" style={{backgroundColor: '#EBF57D', color: '#000000'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Lead
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Lead</DialogTitle>
                    <DialogDescription>
                      Preencha as informações do novo lead para adicionar ao funil.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="opportunityName" className="text-right text-sm font-medium">
                        Oportunidade *
                      </label>
                      <Input
                        id="opportunityName"
                        value={newLead.opportunityName}
                        onChange={(e) => setNewLead({...newLead, opportunityName: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome da oportunidade"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="leadName" className="text-right text-sm font-medium">
                        Nome *
                      </label>
                      <Input
                        id="leadName"
                        value={newLead.leadName}
                        onChange={(e) => setNewLead({...newLead, leadName: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome do lead"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="phone" className="text-right text-sm font-medium">
                        Telefone *
                      </label>
                      <Input
                        id="phone"
                        value={newLead.phone}
                        onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                        className="col-span-3"
                        placeholder="(11) 99999-9999"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="company" className="text-right text-sm font-medium">
                        Empresa
                      </label>
                      <Input
                        id="company"
                        value={newLead.company}
                        onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                        className="col-span-3"
                        placeholder="Nome da empresa"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4 relative">
                      <label htmlFor="source" className="text-right text-sm font-medium">
                        Origem
                      </label>
                      <div className="col-span-3 relative">
                        <Input
                          id="source"
                          value={newLead.source}
                          onChange={(e) => {
                            setNewLead({...newLead, source: e.target.value});
                            setShowOriginSuggestions(e.target.value.length > 0);
                          }}
                          placeholder="Ex: Google Ads, Facebook, Indicação"
                        />
                        {showOriginSuggestions && filteredOrigins.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {filteredOrigins.map((origin, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                                onClick={() => handleOriginSelect(origin)}
                              >
                                {origin}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="email" className="text-right text-sm font-medium">
                        E-mail
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={newLead.email}
                        onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                        className="col-span-3"
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="notes" className="text-right text-sm font-medium">
                        Observações
                      </label>
                      <Input
                        id="notes"
                        value={newLead.notes}
                        onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                        className="col-span-3"
                        placeholder="Observações adicionais"
                      />
                    </div>
                    {addLeadError && (
                      <div className="text-red-500 text-sm mt-2">
                        {addLeadError}
                      </div>
                    )}
                    {addLeadSuccess && (
                      <div className="text-green-500 text-sm mt-2">
                        {addLeadSuccess}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleAddLead} 
                      disabled={addLeadLoading}
                      style={{backgroundColor: '#EBF57D', color: '#000000'}} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}
                    >
                      {addLeadLoading ? 'Adicionando...' : 'Adicionar Lead'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Todos os Status</SelectItem>
                <SelectItem value="open" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Abertos</SelectItem>
                <SelectItem value="won" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Ganhos</SelectItem>
                <SelectItem value="lost" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Perdidos</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            {(searchTerm || statusFilter !== 'open' || (dateRange.from && dateRange.to && (dateRange.from.getTime() !== startOfMonth(new Date()).getTime() || dateRange.to.getTime() !== endOfMonth(new Date()).getTime()))) && (
              <Button variant="outline" size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('open');
                  setDateRange({
                    from: startOfMonth(new Date()),
                    to: endOfMonth(new Date())
                  });
                }}
                className="bg-background/50 border-border/50 hover:bg-muted/50"
              >
                Limpar Filtros
              </Button>
            )}
          </div>
        </div>

        {/* Conteúdo do Pipeline */}
        <div className="flex-1 overflow-hidden">
          <KanbanBoard leads={filteredLeads} />
        </div>
      </div>
    </TooltipProvider>
  );
};

export default Pipeline;
