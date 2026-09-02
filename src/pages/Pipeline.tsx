import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DateRange, DateRangePicker } from "@/components/DateRangePicker";
import { startOfMonth, endOfMonth } from "date-fns";
import { useCRM } from '@/contexts/CRMContext';
import { usePersistentDateRange } from '@/hooks/use-persistent-state';
import { useLeadOrigins } from '@/hooks/use-lead-origins';
import { useIsMobile } from '@/hooks/use-mobile';
import KanbanBoard from '@/components/KanbanBoard';
import { Search, Plus, Filter, Activity, FileDown, ChevronDown, Users } from 'lucide-react';
import { getLeadsByUser } from '@/lib/leads';
import { getMembrosByUser, type Membro } from '@/lib/membros';

type MemberFilterOption = {
  id: string;
  name: string;
};

const Pipeline = () => {
  const { leads, addLead, user } = useCRM();
  const { origins } = useLeadOrigins();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('open-won');
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
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('all');
  const [exportStage, setExportStage] = useState<string>('all');
  const [exportDateRange, setExportDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const [exportStartInput, setExportStartInput] = useState<string>(formatDateForInput(exportDateRange?.from));
  const [exportEndInput, setExportEndInput] = useState<string>(formatDateForInput(exportDateRange?.to));
  useEffect(() => {
    setExportStartInput(formatDateForInput(exportDateRange?.from));
    setExportEndInput(formatDateForInput(exportDateRange?.to));
  }, [exportDateRange]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [companyMembers, setCompanyMembers] = useState<Membro[]>([]);
  const [memberOptions, setMemberOptions] = useState<MemberFilterOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const allColumns = [
    { key: 'lead_id', label: 'ID' },
    { key: 'created_at', label: 'DATA DE CRIAÇÃO' },
    { key: 'update_mensagem', label: 'ÚLTIMA ATUALIZAÇÃO' },
    { key: 'lead_etapa', label: 'ETAPA DO LEAD' },
    { key: 'lead_status', label: 'STATUS' },
    { key: 'lead_nome_pessoa', label: 'NOME' },
    { key: 'lead_empresa', label: 'EMPRESA' },
    { key: 'lead_telefone', label: 'TELEFONE' },
    { key: 'lead_email', label: 'EMAIL' },
    { key: 'lead_canal_origem', label: 'CANAL DE ORIGEM' },
    { key: 'lead_notas', label: 'NOTAS' },
    { key: 'TRIAL', label: 'TRIAL' },
    { key: 'ativo_ia', label: 'IA ESTA ATIVA?' },
    { key: 'conversa', label: 'CONVERSA (IA)' },
  ];
  const selectedColumns = allColumns.map(c => c.key);
  const columnLabels: Record<string, string> =
    Object.fromEntries(allColumns.map(c => [c.key, c.label]));

  const [newLead, setNewLead] = useState({
    opportunityName: '',
    leadName: '',
    phone: '',
    company: '',
    source: '',
    notes: '',
    email: '',
  });
  const normalizeLeadPhone = (value: string) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (!digits) return '';
    const localDigits = digits.startsWith('55') ? digits.slice(2) : digits;
    const limitedLocalDigits = localDigits.slice(0, 11);
    return limitedLocalDigits ? `55${limitedLocalDigits}` : '';
  };
  const formatLeadPhone = (value: string) => {
    const normalized = normalizeLeadPhone(value);
    if (!normalized) return '';
    const localDigits = normalized.slice(2);
    const ddd = localDigits.slice(0, 2);
    const numberDigits = localDigits.slice(2);
    if (!ddd) return '+55';
    if (numberDigits.length === 0) return `+55 (${ddd}`;
    if (numberDigits.length <= 4) return `+55 (${ddd}) ${numberDigits}`;
    if (numberDigits.length <= 8) {
      return `+55 (${ddd}) ${numberDigits.slice(0, 4)}-${numberDigits.slice(4)}`;
    }
    return `+55 (${ddd}) ${numberDigits.slice(0, 5)}-${numberDigits.slice(5, 9)}`;
  };
  const handlePhoneChange = (value: string) => {
    setNewLead((prev) => ({ ...prev, phone: formatLeadPhone(value) }));
  };

  // Filtrar origens baseado no que o usuário está digitando
  const filteredOrigins = origins.filter(origin => 
    origin.toLowerCase().includes(newLead.source.toLowerCase())
  );
  const userIdForCompany = user ? (user.isMembro ? user.user_id_empresa : user.id) : '';
  const currentUserMember = companyMembers.find(
    (member) =>
      String(member.membro_id || '') === String(user?.isMembro ? user?.membroId || '' : user?.id || '')
  );
  const canUseMemberFilter = Boolean(
    currentUserMember?.membro_tipo === 'Administrador'
  );
  const otherActiveMembers = companyMembers.filter((member) => {
    const sameMemberId = String(member.membro_id || '') === String(currentUserMember?.membro_id || '');
    return !sameMemberId;
  });
  const showMemberFilter = canUseMemberFilter && otherActiveMembers.length > 0;

  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      if (!userIdForCompany) {
        if (isMounted) {
          setCompanyMembers([]);
          setMemberOptions([]);
          setSelectedMemberIds([]);
          setMembersLoading(false);
        }
        return;
      }

      setMembersLoading(true);
      const { data, error } = await getMembrosByUser(userIdForCompany);

      if (!isMounted) return;

      if (error || !data) {
        setCompanyMembers([]);
        setMemberOptions([]);
        setSelectedMemberIds([]);
        setMembersLoading(false);
        return;
      }

      const activeMembers = (data as Membro[])
        .filter((membro) => membro.membro_status === 'Ativado');

      const availableMembers = activeMembers
        .filter((membro) => membro.membro_status === 'Ativado')
        .map((membro) => ({
          id: String(membro.membro_id),
          name: String(membro.membro_nome || '').trim() || 'Sem nome',
        }));
      setCompanyMembers(activeMembers);
      setMemberOptions(availableMembers);
      setSelectedMemberIds((prev) => prev.filter((memberId) => availableMembers.some((member) => member.id === memberId)));
      setMembersLoading(false);
    };

    void loadMembers();

    return () => {
      isMounted = false;
    };
  }, [canUseMemberFilter, userIdForCompany]);

  useEffect(() => {
    if (!showMemberFilter && selectedMemberIds.length > 0) {
      setSelectedMemberIds([]);
    }
  }, [showMemberFilter, selectedMemberIds.length]);

  const handleOriginSelect = (origin: string) => {
    setNewLead({...newLead, source: origin});
    setShowOriginSuggestions(false);
  };

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const selectedMembersLabel = (() => {
    if (membersLoading) return 'Carregando membros...';
    if (selectedMemberIds.length === 0) return 'Todos os membros';
    if (selectedMemberIds.length === 1) {
      const selectedMember = memberOptions.find((member) => member.id === selectedMemberIds[0]);
      return selectedMember?.name || '1 membro selecionado';
    }
    return `${selectedMemberIds.length} membros selecionados`;
  })();
  const selectedAdminMemberIds = new Set(
    companyMembers
      .filter(
        (member) =>
          selectedMemberIds.includes(String(member.membro_id)) &&
          member.membro_tipo === 'Administrador'
      )
      .map((member) => String(member.membro_id))
  );
  const shouldIncludeUnassignedLeads = selectedAdminMemberIds.size > 0;

  const matchesSelectedMemberFilter = (memberId: string) => {
    if (selectedMemberIds.length === 0) return true;
    if (selectedMemberIds.includes(memberId)) return true;
    return !memberId && shouldIncludeUnassignedLeads;
  };

  const canViewLead = (lead: any) => {
    if (!user) return false;
    if (!user.isMembro) return true;
    if (user.membro_tipo === 'Administrador') return true;
    const myMembroId = user.membroId ? String(user.membroId).trim() : '';
    if (!myMembroId) return false;
    const leadMembroId = lead?.membro_id ? String(lead.membro_id).trim() : '';
    return leadMembroId === myMembroId;
  };

  const filteredLeads = leads.filter(lead => {
    if (!canViewLead(lead)) return false;
    const matchesSearch = (lead.opportunityName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (lead.leadName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'open-won' && (lead.status === 'active' || lead.status === 'won')) ||
                         (statusFilter === 'open' && lead.status === 'active') ||
                         (statusFilter === 'lost' && lead.status === 'lost') ||
                         (statusFilter === 'won' && lead.status === 'won');
    
    // Filtro por período usando DateRange
    let matchesDate = true;
    if (dateRange?.from && dateRange?.to) {
      const createdAt = new Date(lead.createdAt);
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      // Ajustar para incluir o dia inteiro
      toDate.setHours(23, 59, 59, 999);
      matchesDate = createdAt >= fromDate && createdAt <= toDate;
    }

    const leadMembroId = String(lead?.membro_id || '').trim();
    const matchesMember =
      !showMemberFilter ||
      matchesSelectedMemberFilter(leadMembroId);
    
    return matchesSearch && matchesStatus && matchesDate && matchesMember;
  });

  const handleAddLead = async () => {
    setAddLeadError(null);
    setAddLeadSuccess(null);
    const normalizedPhone = normalizeLeadPhone(newLead.phone);
    
    if (newLead.opportunityName && newLead.leadName && newLead.phone) {
      if (normalizedPhone.length < 12) {
        setAddLeadError('Informe um telefone valido com DDD.');
        return;
      }
      setAddLeadLoading(true);
      
      const leadData = {
        opportunityName: newLead.opportunityName,
        leadName: newLead.leadName,
        phone: normalizedPhone,
        email: newLead.email,
        company: newLead.company,
        source: newLead.source,
        notes: newLead.notes,
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

  const handleExportLeads = async () => {
    setExportError(null);
    if (!user) {
      setExportError('Usuário não autenticado.');
      return;
    }
    setExportLoading(true);
    try {
      const userIdForLeads = user.isMembro ? user.user_id_empresa : user.id;
      let membroIdFilter: string | undefined;
      if (user.isMembro && user.membroId && user.membro_tipo !== 'Administrador') {
        membroIdFilter = user.membroId;
      }
      const { data, error } = await getLeadsByUser(userIdForLeads || '', membroIdFilter);
      if (error) {
        setExportError(error.message || 'Erro ao buscar leads.');
        setExportLoading(false);
        return;
      }
      const excludedOrigins = new Set(['worklivoo-treinamento', 'worklivoo-treinamento-manual', 'worklivoo-lixo']);
      const rows = (data as Record<string, unknown>[] | null | undefined || []).filter((lead) => {
        const origin = String(lead['lead_canal_origem'] || '').trim().toLowerCase();
        if (excludedOrigins.has(origin)) return false;
        const statusOk =
          exportStatus === 'all'
            ? true
            : String(lead['lead_status'] || '').toLowerCase() === exportStatus.toLowerCase();
        const normalize = (s: string) => (s || '').toLowerCase().trim();
        const stageOk =
          exportStage === 'all'
            ? true
            : normalize(String(lead['lead_etapa'] || '')) === normalize(exportStage);
        let dateOk = true;
        if (exportDateRange?.from && exportDateRange?.to) {
          const createdAt = new Date(String(lead['created_at'] || ''));
          const fromDate = new Date(exportDateRange.from);
          const toDate = new Date(exportDateRange.to);
          toDate.setHours(23, 59, 59, 999);
          dateOk = createdAt >= fromDate && createdAt <= toDate;
        }
        const memberId = String(lead['membro_id'] || '').trim();
        const memberOk =
          !showMemberFilter ||
          matchesSelectedMemberFilter(memberId);
        return statusOk && stageOk && dateOk && memberOk;
      });
      const headers = selectedColumns.map((key) => columnLabels[key] || key);
      const escapeCSV = (value: unknown) => {
        const v = value === null || value === undefined ? '' : String(value);
        if (/[",\n]/.test(v)) {
          return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
      };
      const csv = [
        headers.join(','),
        ...rows.map((lead) =>
          selectedColumns
            .map((key) => {
              const raw = lead[key];
              if ((key === 'lead_nome_pessoa' || key === 'lead_nome_oportunidade') && (raw === null || raw === undefined || String(raw).trim() === '')) {
                return escapeCSV('N/A');
              }
              return escapeCSV(raw);
            })
            .join(',')
        ),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads_export_worklivoo_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (e: unknown) {
      setExportError('Erro interno ao exportar leads.');
    } finally {
      setExportLoading(false);
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
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="col-span-3"
                        placeholder="+55 (11) 99999-9999"
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
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="pb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: '#EBF57D'}}>
                        <Plus className="w-5 h-5 text-black" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-semibold text-gray-900">Novo Lead</DialogTitle>
                        <DialogDescription className="text-gray-600 mt-1">
                          Preencha as informações para adicionar um novo lead ao pipeline
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  <div className="space-y-6">
                    {/* Seção Principal */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2">Informações Principais</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="opportunityName" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Oportunidade
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="opportunityName"
                            value={newLead.opportunityName}
                            onChange={(e) => setNewLead({...newLead, opportunityName: e.target.value})}
                            className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder="Nome da oportunidade"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="leadName" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Nome do Lead
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="leadName"
                            value={newLead.leadName}
                            onChange={(e) => setNewLead({...newLead, leadName: e.target.value})}
                            className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder="Nome completo"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção de Contato */}
                     <div className="bg-yellow-50 rounded-lg p-4 space-y-4">
                       <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-yellow-200 pb-2">Informações de Contato</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="phone" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                            Telefone
                            <span className="text-red-500">*</span>
                          </label>
                          <Input
                            id="phone"
                            value={newLead.phone}
                            onChange={(e) => handlePhoneChange(e.target.value)}
                            className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder="+55 (11) 99999-9999"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label htmlFor="email" className="text-sm font-medium text-gray-700">
                            E-mail
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={newLead.email}
                            onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                            className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder="email@exemplo.com"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Seção Empresarial */}
                     <div className="bg-yellow-50 rounded-lg p-4 space-y-4">
                       <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-yellow-200 pb-2">Informações Empresariais</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label htmlFor="company" className="text-sm font-medium text-gray-700">
                            Empresa
                          </label>
                          <Input
                            id="company"
                            value={newLead.company}
                            onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                            className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                            placeholder="Nome da empresa"
                          />
                        </div>
                        
                        <div className="space-y-2 relative">
                          <label htmlFor="source" className="text-sm font-medium text-gray-700">
                            Origem
                          </label>
                          <div className="relative">
                            <Input
                              id="source"
                              value={newLead.source}
                              onChange={(e) => {
                                setNewLead({...newLead, source: e.target.value});
                                setShowOriginSuggestions(e.target.value.length > 0);
                              }}
                              className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                              placeholder="Ex: Google Ads, Facebook, Indicação"
                            />
                            {showOriginSuggestions && filteredOrigins.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                                {filteredOrigins.map((origin, index) => (
                                  <div
                                    key={index}
                                    className="px-3 py-2 hover:bg-yellow-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                    onClick={() => handleOriginSelect(origin)}
                                  >
                                    {origin}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seção de Observações */}
                    <div className="bg-purple-50 rounded-lg p-4 space-y-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-purple-200 pb-2">Observações Adicionais</h3>
                      
                      <div className="space-y-2">
                        <label htmlFor="notes" className="text-sm font-medium text-gray-700">
                          Observações
                        </label>
                        <textarea
                          id="notes"
                          value={newLead.notes}
                          onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                          className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 resize-none"
                          placeholder="Informações adicionais sobre o lead..."
                        />
                      </div>
                    </div>

                    {/* Mensagens de Feedback */}
                    {(addLeadError || addLeadSuccess) && (
                      <div className="rounded-lg p-4" style={{backgroundColor: addLeadError ? '#fef2f2' : '#f0fdf4'}}>
                        {addLeadError && (
                          <div className="flex items-center gap-2 text-red-700">
                            <div className="w-4 h-4 rounded-full bg-red-500 flex-shrink-0"></div>
                            <span className="text-sm font-medium">{addLeadError}</span>
                          </div>
                        )}
                        {addLeadSuccess && (
                          <div className="flex items-center gap-2 text-green-700">
                            <div className="w-4 h-4 rounded-full bg-green-500 flex-shrink-0"></div>
                            <span className="text-sm font-medium">{addLeadSuccess}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer com Botões */}
                  <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      <span className="text-red-500">*</span> Campos obrigatórios
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowNewLeadDialog(false)}
                        className="border-gray-300 text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleAddLead} 
                        disabled={addLeadLoading}
                        className="shadow-lg hover:shadow-xl transition-all duration-300 min-w-[120px]"
                        style={{backgroundColor: '#EBF57D', color: '#000000'}} 
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'} 
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}
                      >
                        {addLeadLoading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                            Salvando...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Adicionar Lead
                          </div>
                        )}
                      </Button>
                    </div>
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
                <SelectItem value="open-won" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Abertos + Vendidos</SelectItem>
                <SelectItem value="open" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Abertos</SelectItem>
                <SelectItem value="won" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Ganhos</SelectItem>
                <SelectItem value="lost" className="focus:bg-[#EBF57D] focus:text-black data-[state=checked]:bg-[#EBF57D] data-[state=checked]:text-black">Perdidos</SelectItem>
              </SelectContent>
            </Select>
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            {showMemberFilter && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full sm:w-[240px] justify-between bg-background/50 border-border/50 hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Users className="w-4 h-4 shrink-0" />
                      <span className="truncate">{selectedMembersLabel}</span>
                    </span>
                    <ChevronDown className="w-4 h-4 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Filtrar por membro</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {membersLoading && (
                    <DropdownMenuItem disabled>Carregando membros...</DropdownMenuItem>
                  )}
                  {!membersLoading && memberOptions.length === 0 && (
                    <DropdownMenuItem disabled>Nenhum membro disponivel</DropdownMenuItem>
                  )}
                  {!membersLoading && memberOptions.map((member) => (
                    <DropdownMenuCheckboxItem
                      key={member.id}
                      checked={selectedMemberIds.includes(member.id)}
                      onCheckedChange={() => toggleMemberSelection(member.id)}
                      onSelect={(event) => event.preventDefault()}
                    >
                      {member.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {!membersLoading && selectedMemberIds.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setSelectedMemberIds([])}>
                        Limpar selecao
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  className="bg-background/50 border-border/50 hover:bg-muted/50"
                  onClick={() => setShowExportDialog(true)}
                >
                  <FileDown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Exportar Leads
              </TooltipContent>
            </Tooltip>
            {(searchTerm || statusFilter !== 'open-won' || selectedMemberIds.length > 0 || (dateRange.from && dateRange.to && (dateRange.from.getTime() !== startOfMonth(new Date()).getTime() || dateRange.to.getTime() !== endOfMonth(new Date()).getTime()))) && (
              <Button variant="outline" size="sm" 
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('open-won');
                  setSelectedMemberIds([]);
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
          <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
            <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
              <DialogHeader className="pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{backgroundColor: '#EBF57D'}}>
                    <FileDown className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-semibold text-gray-900">Exportar Leads</DialogTitle>
                    <DialogDescription className="text-gray-600 mt-1">
                      Defina os parâmetros para exportar os leads do seu pipeline
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-200 pb-2">Parâmetros de Exportação</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Status</label>
                      <Select value={exportStatus} onValueChange={setExportStatus}>
                        <SelectTrigger className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400">
                          <SelectValue placeholder="Todos os Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="Aberto">Aberto</SelectItem>
                          <SelectItem value="Ganho">Ganho</SelectItem>
                          <SelectItem value="Perdido">Perdido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Etapa</label>
                      <Select value={exportStage} onValueChange={setExportStage}>
                        <SelectTrigger className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400">
                          <SelectValue placeholder="Todas as Etapas" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          <SelectItem value="entrada do lead">Entrada do Lead</SelectItem>
                          <SelectItem value="tentando contato">Tentando Contato</SelectItem>
                          <SelectItem value="contato realizado">Contato Realizado</SelectItem>
                          <SelectItem value="oportunidade qualificada">Oportunidade Qualificada</SelectItem>
                          <SelectItem value="orçamento/negociação">Orçamento/Negociação</SelectItem>
                          <SelectItem value="venda">Venda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Período (Data de Criação)</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="export-start" className="text-sm text-gray-700">Data Inicial</label>
                        <Input
                          id="export-start"
                          type="date"
                          value={exportStartInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExportStartInput(v);
                            setExportDateRange(prev => ({
                              from: v ? new Date(v + 'T00:00:00') : undefined,
                              to: prev?.to
                            }));
                          }}
                          className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="export-end" className="text-sm text-gray-700">Data Final</label>
                        <Input
                          id="export-end"
                          type="date"
                          value={exportEndInput}
                          onChange={(e) => {
                            const v = e.target.value;
                            setExportEndInput(v);
                            setExportDateRange(prev => ({
                              from: prev?.from,
                              to: v ? new Date(v + 'T00:00:00') : undefined
                            }));
                          }}
                          className="border-gray-300 focus:border-yellow-400 focus:ring-yellow-400"
                        />
                      </div>
                    </div>
                  </div>
                  {exportError && (
                    <div className="rounded-md p-3 bg-red-50 text-red-700 text-sm border border-red-200">{exportError}</div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                <Button variant="outline" onClick={() => setShowExportDialog(false)} className="border-gray-300 text-gray-700 hover:bg-gray-50">Cancelar</Button>
                <Button
                  onClick={handleExportLeads}
                  disabled={exportLoading}
                  className="shadow-lg hover:shadow-xl transition-all duration-300 min-w-[140px]"
                  style={{backgroundColor: '#EBF57D', color: '#000000'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#d4e06a'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#EBF57D'}
                >
                  {exportLoading ? 'Exportando...' : 'Exportar CSV'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
