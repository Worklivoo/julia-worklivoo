import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import KanbanBoard from '@/components/KanbanBoard';
import { Search, Plus, FileDown, ChevronDown, Users } from 'lucide-react';
import { getLeadsByUser } from '@/lib/leads';
import { getMembrosByUser, type Membro } from '@/lib/membros';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';

type MemberFilterOption = {
  id: string;
  name: string;
};

const Pipeline = () => {
  const { leads, addLead, user } = useCRM();
  const { origins } = useLeadOrigins();
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
  const [memberNamesById, setMemberNamesById] = useState<Record<string, string>>({});
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
    { key: 'membro_id', label: 'RESPONSÁVEL' },
    { key: 'lead_nome_oportunidade', label: 'NOME DA OPORTUNIDADE' },
    { key: 'lead_valor', label: 'VALOR' },
    { key: 'lead_canal_origem', label: 'CANAL DE ORIGEM' },
    { key: 'item_interesse', label: 'ITEM DE INTERESSE' },
    { key: 'link_produto_interessado', label: 'LINK DO PRODUTO' },
    { key: 'TRIAL', label: 'TRIAL' },
    { key: 'ativo_ia', label: 'IA ESTA ATIVA?' },
    { key: 'ativo_followup', label: 'FOLLOWUP ATIVO?' },
    { key: 'ativo_fluxo_cadencia', label: 'CADÊNCIA ATIVA?' },
    { key: 'etapa_fluxo_followup', label: 'ETAPA DO FOLLOWUP' },
    { key: 'followup_dinamico', label: 'FOLLOWUP DINÂMICO?' },
    { key: 'followup_extendido', label: 'FOLLOWUP ESTENDIDO?' },
    { key: 'tentativas_followup', label: 'TENTATIVAS DE FOLLOWUP' },
    { key: 'lead_notas', label: 'NOTAS' },
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
          setMemberNamesById({});
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
        setMemberNamesById({});
        setMemberOptions([]);
        setSelectedMemberIds([]);
        setMembersLoading(false);
        return;
      }

      const allMembers = data as Membro[];
      const activeMembers = allMembers
        .filter((membro) => membro.membro_status === 'Ativado');

      const availableMembers = activeMembers
        .map((membro) => ({
          id: String(membro.membro_id),
          name: String(membro.membro_nome || '').trim() || 'Sem nome',
        }));
      // Inclui membros desativados para que leads antigos ainda exportem o nome do responsável.
      const namesById = Object.fromEntries(
        allMembers.map((membro) => [String(membro.membro_id), String(membro.membro_nome || '').trim() || 'Sem nome'])
      );
      setCompanyMembers(activeMembers);
      setMemberNamesById(namesById);
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
      const booleanColumns = new Set(['ativo_followup', 'followup_dinamico', 'followup_extendido']);
      const csv = [
        headers.join(','),
        ...rows.map((lead) =>
          selectedColumns
            .map((key) => {
              const raw = lead[key];
              if (key === 'membro_id') {
                const memberId = String(raw || '').trim();
                if (!memberId) return escapeCSV('Sem responsável');
                return escapeCSV(memberNamesById[memberId] || 'Membro removido');
              }
              if (booleanColumns.has(key)) {
                if (raw === null || raw === undefined) return escapeCSV('');
                return escapeCSV(raw === true || String(raw).toLowerCase() === 'true' ? 'Sim' : 'Não');
              }
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
    } catch {
      setExportError('Erro interno ao exportar leads.');
    } finally {
      setExportLoading(false);
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    statusFilter !== 'open-won' ||
    selectedMemberIds.length > 0 ||
    (dateRange.from && dateRange.to && (dateRange.from.getTime() !== startOfMonth(new Date()).getTime() || dateRange.to.getTime() !== endOfMonth(new Date()).getTime()))
  );

  return (
    <TooltipProvider>
      <div className="wl-scope wl-page wl-page--board">
        <header className="wl-page__head wl-page__head--compact">
          <div>
            <p className="wl-eyebrow">Funil de Atendimento da Julia</p>
            <h1 className="wl-page__title">Funil de leads</h1>
            <p className="wl-lede">Gerencie seus leads e oportunidades de vendas.</p>
          </div>

          <Dialog open={showNewLeadDialog} onOpenChange={setShowNewLeadDialog}>
            <DialogTrigger asChild>
              <button type="button" className="wl-btn wl-btn--lime">
                <Plus className="wl-btn__arrow" aria-hidden="true" />
                Novo lead
              </button>
            </DialogTrigger>
            <DialogContent className="wl-scope wl-modal sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
              <DialogHeader className="wl-modal__head">
                <DialogTitle className="wl-title wl-title--sm">Novo lead</DialogTitle>
                <DialogDescription className="wl-lede">
                  Preencha as informações para adicionar um novo lead ao funil.
                </DialogDescription>
              </DialogHeader>

              <div className="wl-modal__section">
                <div className="wl-grid">
                  <div className="wl-field">
                    <label htmlFor="opportunityName" className="wl-label">Oportunidade <span className="wl-req">*</span></label>
                    <input
                      id="opportunityName"
                      className="wl-input"
                      value={newLead.opportunityName}
                      onChange={(e) => setNewLead({...newLead, opportunityName: e.target.value})}
                      placeholder="Nome da oportunidade"
                    />
                  </div>
                  <div className="wl-field">
                    <label htmlFor="leadName" className="wl-label">Nome do lead <span className="wl-req">*</span></label>
                    <input
                      id="leadName"
                      className="wl-input"
                      value={newLead.leadName}
                      onChange={(e) => setNewLead({...newLead, leadName: e.target.value})}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="wl-field">
                    <label htmlFor="phone" className="wl-label">Telefone <span className="wl-req">*</span></label>
                    <input
                      id="phone"
                      className="wl-input"
                      value={newLead.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="+55 (11) 99999-9999"
                    />
                  </div>
                  <div className="wl-field">
                    <label htmlFor="email" className="wl-label">E-mail</label>
                    <input
                      id="email"
                      type="email"
                      className="wl-input"
                      value={newLead.email}
                      onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="wl-field">
                    <label htmlFor="company" className="wl-label">Empresa</label>
                    <input
                      id="company"
                      className="wl-input"
                      value={newLead.company}
                      onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="wl-field wl-field--rel">
                    <label htmlFor="source" className="wl-label">Origem</label>
                    <input
                      id="source"
                      className="wl-input"
                      autoComplete="off"
                      value={newLead.source}
                      onChange={(e) => {
                        setNewLead({...newLead, source: e.target.value});
                        setShowOriginSuggestions(e.target.value.length > 0);
                      }}
                      placeholder="Ex: Google Ads, Facebook, Indicação"
                    />
                    {showOriginSuggestions && filteredOrigins.length > 0 && (
                      <div className="wl-suggest">
                        {filteredOrigins.map((origin, index) => (
                          <button key={index} type="button" onClick={() => handleOriginSelect(origin)}>
                            {origin}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="wl-field">
                  <label htmlFor="notes" className="wl-label">Observações</label>
                  <textarea
                    id="notes"
                    className="wl-input"
                    value={newLead.notes}
                    onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                    placeholder="Informações adicionais sobre o lead..."
                  />
                </div>
              </div>

              {addLeadError && <p className="wl-alert wl-gap-top" role="alert">{addLeadError}</p>}
              {addLeadSuccess && <p className="wl-alert wl-alert--ok wl-gap-top" role="status">{addLeadSuccess}</p>}

              <div className="wl-modal__foot">
                <span className="wl-hint"><span className="wl-req">*</span> Campos obrigatórios</span>
                <div className="wl-modal__foot-actions">
                  <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setShowNewLeadDialog(false)}>
                    Cancelar
                  </button>
                  <button type="button" className="wl-btn wl-btn--lime" onClick={handleAddLead} disabled={addLeadLoading}>
                    {addLeadLoading ? (
                      <>
                        <span className="wl-spinner" aria-hidden="true" />
                        Salvando...
                      </>
                    ) : (
                      'Adicionar lead'
                    )}
                  </button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </header>

        <div className="wl-toolbar">
          <div className="wl-toolbar__search">
            <Search className="wl-control__icon" aria-hidden="true" />
            <input
              className="wl-input wl-input--icon"
              placeholder="Buscar leads..."
              aria-label="Buscar leads"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="wl-input wl-toolbar__select" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="wl-scope wl-menu">
              <SelectItem value="all" className="wl-menu__item">Todos os status</SelectItem>
              <SelectItem value="open-won" className="wl-menu__item">Abertos + Vendidos</SelectItem>
              <SelectItem value="open" className="wl-menu__item">Abertos</SelectItem>
              <SelectItem value="won" className="wl-menu__item">Vendidos</SelectItem>
              <SelectItem value="lost" className="wl-menu__item">Perdidos</SelectItem>
            </SelectContent>
          </Select>

          <DateRangePicker
            variant="worklivoo"
            className="wl-toolbar__date"
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />

          {showMemberFilter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="wl-btn wl-btn--glass wl-toolbar__members">
                  <span>
                    <Users aria-hidden="true" width={16} height={16} />
                    <span>{selectedMembersLabel}</span>
                  </span>
                  <ChevronDown aria-hidden="true" width={16} height={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="wl-scope wl-menu w-72">
                <DropdownMenuLabel className="wl-label">Filtrar por membro</DropdownMenuLabel>
                <DropdownMenuSeparator className="wl-menu__sep" />
                {membersLoading && (
                  <DropdownMenuItem disabled className="wl-menu__item">Carregando membros...</DropdownMenuItem>
                )}
                {!membersLoading && memberOptions.length === 0 && (
                  <DropdownMenuItem disabled className="wl-menu__item">Nenhum membro disponível</DropdownMenuItem>
                )}
                {!membersLoading && memberOptions.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    className="wl-menu__item"
                    checked={selectedMemberIds.includes(member.id)}
                    onCheckedChange={() => toggleMemberSelection(member.id)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {member.name}
                  </DropdownMenuCheckboxItem>
                ))}
                {!membersLoading && selectedMemberIds.length > 0 && (
                  <>
                    <DropdownMenuSeparator className="wl-menu__sep" />
                    <DropdownMenuItem className="wl-menu__item" onClick={() => setSelectedMemberIds([])}>
                      Limpar seleção
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="wl-btn wl-btn--glass wl-btn--icon"
                aria-label="Exportar leads"
                onClick={() => setShowExportDialog(true)}
              >
                <FileDown aria-hidden="true" width={16} height={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="wl-scope wl-tip">Exportar leads</TooltipContent>
          </Tooltip>

          {hasActiveFilters && (
            <button
              type="button"
              className="wl-btn wl-btn--glass"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('open-won');
                setSelectedMemberIds([]);
                setDateRange({
                  from: startOfMonth(new Date()),
                  to: endOfMonth(new Date())
                });
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>

        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent className="wl-scope wl-modal sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
            <DialogHeader className="wl-modal__head">
              <DialogTitle className="wl-title wl-title--sm">Exportar leads</DialogTitle>
              <DialogDescription className="wl-lede">
                Defina os parâmetros para exportar os leads do seu funil em CSV.
              </DialogDescription>
            </DialogHeader>

            <div className="wl-modal__section">
              <div className="wl-grid">
                <div className="wl-field">
                  <label className="wl-label">Status</label>
                  <Select value={exportStatus} onValueChange={setExportStatus}>
                    <SelectTrigger className="wl-input">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent className="wl-scope wl-menu">
                      <SelectItem value="all" className="wl-menu__item">Todos</SelectItem>
                      <SelectItem value="Aberto" className="wl-menu__item">Aberto</SelectItem>
                      <SelectItem value="Vendido" className="wl-menu__item">Vendido</SelectItem>
                      <SelectItem value="Perdido" className="wl-menu__item">Perdido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="wl-field">
                  <label className="wl-label">Etapa</label>
                  <Select value={exportStage} onValueChange={setExportStage}>
                    <SelectTrigger className="wl-input">
                      <SelectValue placeholder="Todas as etapas" />
                    </SelectTrigger>
                    <SelectContent className="wl-scope wl-menu">
                      <SelectItem value="all" className="wl-menu__item">Todas</SelectItem>
                      <SelectItem value="entrada do lead" className="wl-menu__item">Entrada do Lead</SelectItem>
                      <SelectItem value="tentando contato" className="wl-menu__item">Tentando Contato</SelectItem>
                      <SelectItem value="contato realizado" className="wl-menu__item">Contato Realizado</SelectItem>
                      <SelectItem value="oportunidade qualificada" className="wl-menu__item">Oportunidade Qualificada</SelectItem>
                      <SelectItem value="orçamento/negociação" className="wl-menu__item">Orçamento/Negociação</SelectItem>
                      <SelectItem value="venda" className="wl-menu__item">Venda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="wl-field">
                  <label htmlFor="export-start" className="wl-label">Data inicial (criação)</label>
                  <input
                    id="export-start"
                    type="date"
                    className="wl-input"
                    value={exportStartInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExportStartInput(v);
                      setExportDateRange(prev => ({
                        from: v ? new Date(v + 'T00:00:00') : undefined,
                        to: prev?.to
                      }));
                    }}
                  />
                </div>
                <div className="wl-field">
                  <label htmlFor="export-end" className="wl-label">Data final (criação)</label>
                  <input
                    id="export-end"
                    type="date"
                    className="wl-input"
                    value={exportEndInput}
                    onChange={(e) => {
                      const v = e.target.value;
                      setExportEndInput(v);
                      setExportDateRange(prev => ({
                        from: prev?.from,
                        to: v ? new Date(v + 'T00:00:00') : undefined
                      }));
                    }}
                  />
                </div>
              </div>
            </div>

            {exportError && <p className="wl-alert wl-gap-top" role="alert">{exportError}</p>}

            <div className="wl-modal__foot">
              <span />
              <div className="wl-modal__foot-actions">
                <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setShowExportDialog(false)}>
                  Cancelar
                </button>
                <button type="button" className="wl-btn wl-btn--lime" onClick={handleExportLeads} disabled={exportLoading}>
                  {exportLoading ? (
                    <>
                      <span className="wl-spinner" aria-hidden="true" />
                      Exportando...
                    </>
                  ) : (
                    'Exportar CSV'
                  )}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <KanbanBoard leads={filteredLeads} />
      </div>
    </TooltipProvider>
  );
};

export default Pipeline;
