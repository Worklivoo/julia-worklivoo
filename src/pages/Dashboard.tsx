import { useEffect, useMemo, useRef, useState } from 'react';
import { DateRange } from "@/components/DateRangePicker";
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";

import { useCRM } from '@/contexts/CRMContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';
import { getLeadsByUser } from '@/lib/leads';
import InfoTip from '@/components/InfoTip';
import { Lead } from '@/types';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';

// Cores dos gráficos vêm dos tokens (o recharts aceita var() nos atributos SVG).
const CHART = {
  bar: 'var(--ink)',
  grid: 'var(--line)',
  tick: 'var(--muted-soft)',
  cursor: 'var(--line-soft)',
};

const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="wl-chart-tip">
      <p className="wl-chart-tip__label">{label}</p>
      <p className="wl-chart-tip__value"><strong>{payload[0].value}</strong> leads</p>
    </div>
  );
};

type LeadsV2DashboardRow = {
  lead_id?: number;
  created_at?: string | null;
  lead_etapa?: string | null;
  lead_status?: string | null;
  lead_canal_origem?: string | null;
  lead_nome_pessoa?: string | null;
  lead_nome_oportunidade?: string | null;
  lead_telefone?: string | null;
  TRIAL?: string | null;
};

type DashboardLead = Lead & {
  trial?: string | null;
};

const getCurrentMonthRange = (): DateRange => {
  const today = new Date()
  return {
    from: startOfMonth(today),
    to: endOfMonth(today)
  }
}

const clampToMonth = (year: number, monthIndex: number, day: number) => {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.min(Math.max(1, day), lastDay);
  return new Date(year, monthIndex, safeDay);
};

const getDefaultBillingCycleRange = (dueDayRaw: unknown): DateRange => {
  const dueDay = Number(dueDayRaw);
  if (!Number.isFinite(dueDay) || dueDay <= 0) {
    return getCurrentMonthRange();
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const todayNoTime = new Date(year, month, now.getDate());

  const dueThisMonth = clampToMonth(year, month, dueDay);
  if (todayNoTime < dueThisMonth) {
    return {
      from: clampToMonth(year, month - 1, dueDay),
      to: dueThisMonth,
    };
  }

  return {
    from: dueThisMonth,
    to: clampToMonth(year, month + 1, dueDay),
  };
};

const Dashboard = () => {
  const { user } = useCRM();
  const isMobile = useIsMobile();
  const [dashboardLeads, setDashboardLeads] = useState<DashboardLead[]>([]);

  const mapLeadEtapaToStage = (leadEtapa: string | null | undefined): Lead['stage'] => {
    switch (String(leadEtapa || '').trim()) {
      case 'Entrada do lead':
      case 'Entrada do Lead':
        return 'entrada';
      case 'Tentando contato':
      case 'Tentando Contato':
        return 'tentando-contato';
      case 'Contato realizado':
      case 'Contato Realizado':
        return 'contato-realizado';
      case 'Oportunidade qualificada':
      case 'Oportunidade Qualificada':
        return 'qualificada';
      case 'Orçamento/Negociação':
      case 'Orcamento/Negociacao':
        return 'orcamento-negociacao';
      case 'Venda':
        return 'venda';
      default:
        return 'entrada';
    }
  };

  const mapLeadStatus = (leadStatus: string | null | undefined): Lead['status'] => {
    const normalized = String(leadStatus || '').trim().toLowerCase();
    if (normalized === 'vendido' || normalized === 'ganho' || normalized === 'won') return 'won';
    if (normalized === 'perdido' || normalized === 'lost') return 'lost';
    return 'active';
  };

  const normalizeString = (value: unknown) => {
    return typeof value === 'string' ? value.trim() : '';
  };

  useEffect(() => {
    const loadDashboardLeads = async () => {
      const ownerUserId = user?.isMembro ? user?.user_id_empresa : user?.id;
      if (!ownerUserId) {
        setDashboardLeads([]);
        return;
      }

      const { data, error } = await getLeadsByUser(ownerUserId);
      if (error || !data) {
        setDashboardLeads([]);
        return;
      }

      const mapped: DashboardLead[] = (data as LeadsV2DashboardRow[]).map((lead) => {
        const leadName = normalizeString(lead.lead_nome_pessoa) || normalizeString(lead.lead_telefone) || 'N/A';
        const opportunityName = normalizeString(lead.lead_nome_oportunidade) || normalizeString(lead.lead_telefone) || 'N/A';

        return {
        id: String(lead.lead_id ?? ''),
        opportunityName,
        leadName,
        email: '',
        phone: '',
        stage: mapLeadEtapaToStage(lead.lead_etapa),
        status: mapLeadStatus(lead.lead_status),
        createdAt: lead.created_at ? new Date(String(lead.created_at).replace(' ', 'T')) : new Date(),
        updatedAt: new Date(),
        source: String(lead.lead_canal_origem || ''),
        value: 0,
        notes: [],
        priority: 'medium' as const,
        trial: typeof lead.TRIAL === 'string' ? lead.TRIAL : null,
      }});

      setDashboardLeads(mapped);
    };

    loadDashboardLeads();
  }, [user?.id, user?.user_id_empresa, user?.isMembro]);

  const planoLeads = useMemo(() => {
    const fromQuantidade = user?.planoQuantidadeLeads;
    if (typeof fromQuantidade === 'number' && Number.isFinite(fromQuantidade) && fromQuantidade > 0) {
      return fromQuantidade;
    }

    const fromPlanoString = typeof user?.plano === 'string' ? Number(user.plano) : NaN;
    if (Number.isFinite(fromPlanoString) && fromPlanoString > 0) {
      return fromPlanoString;
    }

    return 500;
  }, [user?.plano, user?.planoQuantidadeLeads]);

  const [dateRange, setDateRange] = useState<DateRange>(() => getDefaultBillingCycleRange(user?.dia_vencimento))
  const hasUserAdjustedDateRangeRef = useRef(false);

  useEffect(() => {
    if (hasUserAdjustedDateRangeRef.current) return;
    setDateRange(getDefaultBillingCycleRange(user?.dia_vencimento));
  }, [user?.dia_vencimento]);

  const handleDateRangeChange = (next: DateRange) => {
    hasUserAdjustedDateRangeRef.current = true;
    setDateRange(next);
  };

  // Filtrar leads baseado no período selecionado
  const filteredLeads = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) {
      return dashboardLeads;
    }
    
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);

    return dashboardLeads.filter(lead => {
      const leadDate = new Date(lead.createdAt);
      return leadDate >= from && leadDate <= to;
    });
  }, [dashboardLeads, dateRange]);

  const filteredLeadsPlano = useMemo(() => {
    return filteredLeads.filter((lead) => String(lead.trial || '').trim().toUpperCase() !== 'SIM');
  }, [filteredLeads]);

  // Memoizar dados dos gráficos para evitar recálculos desnecessários
  const stageData = useMemo(() => [
    { name: 'Entrada Lead', value: filteredLeads.filter(l => l.stage === 'entrada').length },
    { name: 'Tentando Contato', value: filteredLeads.filter(l => l.stage === 'tentando-contato').length },
    { name: 'Contato Realizado', value: filteredLeads.filter(l => l.stage === 'contato-realizado').length },
    { name: 'Oport. Qualificada', value: filteredLeads.filter(l => l.stage === 'qualificada').length },
    { name: 'Orçam./Neg.', value: filteredLeads.filter(l => l.stage === 'orcamento-negociacao').length },
    { name: 'Venda', value: filteredLeads.filter(l => l.stage === 'venda').length },
  ], [filteredLeads]);

  // Memoizar origens dos leads filtrados
  const topOrigins = useMemo(() => {
    const origins = filteredLeads.reduce((acc, lead) => {
      const source = lead.source || 'Sem origem definida';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(origins)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredLeads]);
  
  // Memoizar dados de origem
  const sourceData = useMemo(() => {
    return topOrigins.length > 0 
      ? topOrigins.map(origin => ({
          name: origin.name,
          value: origin.count
        }))
      : [
          { name: 'Sem origem definida', value: filteredLeads.filter(l => !l.source || l.source.trim() === '').length }
        ];
  }, [topOrigins, filteredLeads]);

  // Memoizar cálculos de leads do período selecionado
  const leadsDoPeriodo = useMemo(() => {
    const leadsNoPeriodo = filteredLeads;
    const leadsAbertosNoPeriodo = leadsNoPeriodo.filter(l => l.status === 'active');
    const leadsQualificadosNoPeriodo = leadsNoPeriodo.filter(l =>
      ['qualificada', 'orcamento-negociacao', 'venda'].includes(l.stage)
    );
    const taxaConversaoQualificados = leadsNoPeriodo.length > 0 ? (leadsQualificadosNoPeriodo.length / leadsNoPeriodo.length) * 100 : 0;

    return {
      leadsNoPeriodo,
      leadsAbertosNoPeriodo,
      leadsQualificadosNoPeriodo,
      taxaConversaoQualificados
    };
  }, [filteredLeads]);

  const leadsPlanoDoPeriodo = useMemo(() => {
    return {
      leadsNoPeriodo: filteredLeadsPlano,
    };
  }, [filteredLeadsPlano]);


  const planoUsadoPct = planoLeads > 0 ? (leadsPlanoDoPeriodo.leadsNoPeriodo.length / planoLeads) * 100 : 0;
  const planoExcedentes = leadsPlanoDoPeriodo.leadsNoPeriodo.length - planoLeads;
  const maxOrigem = Math.max(1, ...sourceData.map((o) => o.value));

  const stageShortNames: Record<string, string> = {
    'Entrada Lead': 'Entrada',
    'Tentando Contato': 'Contato',
    'Contato Realizado': 'Realizado',
    'Oport. Qualificada': 'Qualificada',
    'Orçam./Neg.': 'Orç./Neg.',
    'Venda': 'Venda',
  };

  const getInitials = (name: string) =>
    (name || '?').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();

  const recentLeads = [...leadsDoPeriodo.leadsAbertosNoPeriodo]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const renderBarChart = (data: { name: string; value: number }[], height: number, bottom: number) => (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 24, right: 12, left: -12, bottom }}>
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="name" tick={{ fill: CHART.tick, fontSize: 11.5, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: CHART.tick, fontSize: 11.5, fontWeight: 500 }} axisLine={false} tickLine={false} />
        <RechartsTooltip cursor={{ fill: CHART.cursor }} content={<ChartTip />} />
        <Bar dataKey="value" fill={CHART.bar} radius={[8, 8, 0, 0]} maxBarSize={56}>
          <LabelList dataKey="value" position="top" fill={CHART.bar} fontSize={12} fontWeight={800} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="wl-scope wl-page">
      <header className="wl-page__head">
        <div>
          <p className="wl-eyebrow">Resultados gerais da Julia</p>
          <h1 className="wl-page__title">Bem-vindo, {user?.nome || 'Usuário'}!</h1>
        </div>
        <DateRangePicker
          variant="worklivoo"
          dateRange={dateRange}
          onDateRangeChange={handleDateRangeChange}
          placeholder="Selecione o período"
        />
      </header>

      <section className="wl-section" aria-labelledby="dash-resumo">
        <div className="wl-section__head">
          <h2 id="dash-resumo" className="wl-section__title">Resumo do período</h2>
          <p className="wl-lede">Números dos leads que entraram no período selecionado.</p>
        </div>

        <div className="wl-stats">
          <article className="wl-stat">
            <div className="wl-stat__top">
              <span className="wl-stat__label">Plano de leads</span>
              <InfoTip label="Plano de leads">
                <p><strong>Leads recebidos no período</strong> em relação ao limite do seu plano ({planoLeads} leads).</p>
                <p>Leads de teste (trial) não entram na conta. O período padrão é o seu ciclo de cobrança.</p>
              </InfoTip>
            </div>
            <span className="wl-stat__value">
              {leadsPlanoDoPeriodo.leadsNoPeriodo.length}
              <span className="wl-stat__unit">/{planoLeads}</span>
            </span>
            <div className="wl-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round(planoUsadoPct), 100)}>
              <div className="wl-meter__fill" style={{ width: `${Math.min(planoUsadoPct, 100)}%` }} />
            </div>
            <div className="wl-stat__foot">
              <p className="wl-stat__meta">{Math.round(planoUsadoPct)}% usado</p>
              <p className="wl-stat__meta">{Math.max(0, planoLeads - leadsPlanoDoPeriodo.leadsNoPeriodo.length)} restantes</p>
            </div>
            {typeof user?.dia_vencimento === 'number' && user.dia_vencimento > 0 && (
              <p className="wl-stat__meta">Ciclo fecha dia {user.dia_vencimento}</p>
            )}
            {planoExcedentes > 0 && (
              <span className="wl-pill wl-pill--danger">+{planoExcedentes} excedentes</span>
            )}
          </article>

          <article className="wl-stat">
            <div className="wl-stat__top">
              <span className="wl-stat__label">Leads em aberto</span>
              <InfoTip label="Leads em aberto">
                <p><strong>Leads do período ainda em andamento</strong>: não foram marcados como vendidos nem como perdidos.</p>
              </InfoTip>
            </div>
            <span className="wl-stat__value">{leadsDoPeriodo.leadsAbertosNoPeriodo.length}</span>
            <p className="wl-stat__meta">
              Ativos entre os {leadsDoPeriodo.leadsNoPeriodo.length} leads do período
            </p>
          </article>

          <article className="wl-stat">
            <div className="wl-stat__top">
              <span className="wl-stat__label">Oportunidades qualificadas</span>
              <InfoTip label="Oportunidades qualificadas">
                <p><strong>Leads do período que chegaram</strong> às etapas Oportunidade qualificada, Orçamento/Negociação ou Venda.</p>
                <p>Contam mesmo que o lead tenha sido perdido depois.</p>
              </InfoTip>
            </div>
            <span className="wl-stat__value">{leadsDoPeriodo.leadsQualificadosNoPeriodo.length}</span>
            <p className="wl-stat__meta">{leadsDoPeriodo.leadsNoPeriodo.length} leads no período</p>
          </article>

          <article className="wl-stat wl-stat--ink">
            <div className="wl-stat__top">
              <span className="wl-stat__label">Taxa de conversão</span>
              <InfoTip label="Taxa de conversão">
                <p><strong>Oportunidades qualificadas ÷ total de leads</strong> do período.</p>
                <p>Mostra quantos leads viraram oportunidade, não quantos viraram venda.</p>
              </InfoTip>
            </div>
            <span className="wl-stat__value">{leadsDoPeriodo.taxaConversaoQualificados.toFixed(1)}%</span>
            <div className="wl-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(leadsDoPeriodo.taxaConversaoQualificados)}>
              <div className="wl-meter__fill" style={{ width: `${Math.min(leadsDoPeriodo.taxaConversaoQualificados, 100)}%` }} />
            </div>
            <p className="wl-stat__meta">Qualificados sobre o total de leads</p>
          </article>
        </div>
      </section>

      <section className="wl-section" aria-labelledby="dash-funil">
        <div className="wl-section__head">
          <h2 id="dash-funil" className="wl-section__title">Funil de leads</h2>
          <p className="wl-lede">Distribuição atual do funil de vendas.</p>
        </div>

        {isMobile ? (
          <div className="wl-minis">
            {stageData.map((stage) => (
              <div key={stage.name} className="wl-mini">
                <span className="wl-mini__value">{stage.value}</span>
                <span className="wl-mini__label">{stageShortNames[stage.name] || stage.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="wl-panel">{renderBarChart(stageData, 380, 24)}</div>
        )}
      </section>

      <section className="wl-section" aria-labelledby="dash-origem">
        <div className="wl-section__head">
          <h2 id="dash-origem" className="wl-section__title">Origem dos leads</h2>
          <p className="wl-lede">Principais canais de aquisição.</p>
        </div>

        {isMobile ? (
          <div className="wl-bars">
            {sourceData.map((origin) => (
              <div key={origin.name}>
                <div className="wl-bars__row-head">
                  <span className="wl-bars__name">{origin.name}</span>
                  <span className="wl-bars__count">{origin.value}</span>
                </div>
                <div className="wl-meter">
                  <div className="wl-meter__fill" style={{ width: `${(origin.value / maxOrigem) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="wl-panel">{renderBarChart(sourceData, 320, 8)}</div>
        )}
      </section>

      <section className="wl-section" aria-labelledby="dash-recentes">
        <div className="wl-section__head">
          <h2 id="dash-recentes" className="wl-section__title">Leads recentes</h2>
          <p className="wl-lede">Últimas oportunidades do período selecionado.</p>
        </div>

        {recentLeads.length > 0 ? (
          <div className="wl-table">
            <div className="wl-table__row wl-table__row--head" aria-hidden="true">
              <span>Lead</span>
              <span>Origem</span>
              <span className="wl-table__right">Entrada</span>
            </div>
            {recentLeads.map((lead) => (
              <div key={lead.id} className="wl-table__row">
                <div className="wl-person">
                  <span className="wl-avatar" aria-hidden="true">{getInitials(lead.leadName)}</span>
                  <div className="wl-person__text">
                    <p className="wl-person__name">{lead.opportunityName}</p>
                    <p className="wl-person__sub">{lead.leadName}</p>
                  </div>
                </div>
                <div className="wl-table__origin">
                  <span className="wl-pill">{lead.source || 'Sem origem'}</span>
                </div>
                <div className="wl-table__right wl-table__when">
                  <p className="wl-when__date">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                  <p className="wl-when__time">
                    {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="wl-empty">
            <span className="wl-empty__icon"><Users aria-hidden="true" /></span>
            <p className="wl-empty__title">Nenhum lead encontrado neste período</p>
            <p className="wl-empty__text">Novos leads aparecerão aqui quando criados.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;
