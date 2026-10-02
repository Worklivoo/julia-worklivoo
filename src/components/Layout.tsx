import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Sidebar.css';
import { AlertTriangle, Copy, QrCode, X } from 'lucide-react';
import '@/styles/worklivoo-settings.css';
import { toast } from 'sonner';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { asaasFetch, getAsaasApiKey } from '@/utils/asaas';
import ComunicadoModal from '@/components/ComunicadoModal';
import { NotificationPanel } from '@/components/NotificationPanel';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-shell.css';
import type { ComunicadoV2, TarefaAtrasada } from '@/types';
import {
  fetchActiveComunicado,
  fetchHistoricoByUserAndComunicado,
  upsertHistoricoIncrementView,
  updateHistoricoOcultar,
  deveMostrarComunicado,
  getSharedSessionId,
  foiMostradoNaSessaoAtual,
  marcarMostradoNaSessaoAtual,
  pingSharedSession,
  comunicadoDeveMostrarParaUsuario,
} from '@/lib/comunicados';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const navigate = useNavigate();
  const { user, needsNpsSurvey, submitNps } = useCRM();
  const [showPixReminder, setShowPixReminder] = useState(false);
  const [showPixQr, setShowPixQr] = useState(false);
  const [isLoadingPixQr, setIsLoadingPixQr] = useState(false);
  const [pixDueDay, setPixDueDay] = useState<number | null>(null);
  const [pixNextDueDate, setPixNextDueDate] = useState<Date | null>(null);
  const [pixSubscriptionId, setPixSubscriptionId] = useState<string | null>(null);
  const [pixQrData, setPixQrData] = useState<{ encodedImage: string; payload: string; paymentId: string } | null>(null);
  const [isSubmittingNps, setIsSubmittingNps] = useState(false);
  const [npsError, setNpsError] = useState('');
  const [npsSuporte, setNpsSuporte] = useState<number | null>(null);
  const [npsIa, setNpsIa] = useState<number | null>(null);
  const [npsPadrao, setNpsPadrao] = useState<number | null>(null);
  const [npsStep, setNpsStep] = useState(0);
  const [showComunicado, setShowComunicado] = useState(false);
  const [currentComunicado, setCurrentComunicado] = useState<ComunicadoV2 | null>(null);
  const [planStatus, setPlanStatus] = useState<string | null>(null);

  // Só em desenvolvimento: ?demo=atraso,tarefas,comunicado mostra o banner, as notificações e o comunicado de exemplo.
  const demo = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('demo') || '' : '';
  const demoTarefas: TarefaAtrasada[] | null = demo.includes('tarefas') ? [
    { tarefa_id: 'd1', tarefa_titulo: 'Ligar para confirmar test drive', tarefa_descricao: null, lead_id: 1, lead_nome: 'Carlos Almeida', lead_oportunidade: 'Onix 1.0 Flex 2021', membro_nome: null, data_vencimento: new Date(Date.now() - 3 * 86400000).toISOString(), criado_em: new Date().toISOString() },
    { tarefa_id: 'd2', tarefa_titulo: 'Enviar proposta de financiamento', tarefa_descricao: null, lead_id: 2, lead_nome: 'Marina Souza', lead_oportunidade: null, membro_nome: null, data_vencimento: new Date(Date.now() - 5 * 3600000).toISOString(), criado_em: new Date().toISOString() },
    { tarefa_id: 'd3', tarefa_titulo: 'Retornar contato sobre troca do veículo', tarefa_descricao: null, lead_id: 3, lead_nome: 'Rafael Lima', lead_oportunidade: 'Toro Freedom 2023', membro_nome: null, data_vencimento: new Date(Date.now() - 20 * 60000).toISOString(), criado_em: new Date().toISOString() },
  ] : null;
  const demoComunicado: ComunicadoV2 = { comunicado_id: 1, comunicado_titulo: 'Novo: FollowUp Dinâmico', comunicado_imagem: null, comunicado_ativo: true, max_visualizacoes: 3, criado_em: null };
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [tarefasAtrasadas, setTarefasAtrasadas] = useState<TarefaAtrasada[]>([]);
  const [loadingTarefas, setLoadingTarefas] = useState(false);

  const comunicadoSessionStorageSyncRef = useMemo(() => ({ sessionId: getSharedSessionId() }), []);
  const billingOwnerUserId = useMemo(() => {
    if (!user) return null;
    return user.isMembro ? (user.user_id_empresa || null) : user.id;
  }, [user]);

  const parseTimestamp = (value: unknown): number => {
    const raw = typeof value === 'string' ? value : '';
    if (!raw) return 0;
    const normalized = raw
      .replace(' ', 'T')
      .replace(/\+00:00$/, 'Z')
      .replace(/\+00$/, 'Z')
      .replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const buscarTarefasAtrasadas = useCallback(async () => {
    if (!billingOwnerUserId) {
      setTarefasAtrasadas([]);
      return;
    }

    setLoadingTarefas(true);
    const correlationId = `tarefas-atrasadas-${Date.now()}`;
    try {
      console.log(`[Layout][tarefas-atrasadas][${correlationId}] Buscando tarefas atrasadas para user_id=${billingOwnerUserId}`);

      const { data: tarefasData, error: tarefasError } = await supabase
        .from('lead_tarefas_v2')
        .select('tarefa_id, tarefa_titulo, tarefa_descricao, lead_id, user_id, membro_id, data_vencimento, tarefa_concluida, criado_em')
        .eq('user_id', billingOwnerUserId)
        .eq('tarefa_concluida', false)
        .not('data_vencimento', 'is', null);

      if (tarefasError) {
        console.error(`[Layout][tarefas-atrasadas][${correlationId}] Erro na query:`, tarefasError);
        setTarefasAtrasadas([]);
        return;
      }

      const agora = Date.now();
      const atrasadasBrutas = (Array.isArray(tarefasData) ? tarefasData : []).filter((r: any) => {
        const t = parseTimestamp((r as any).data_vencimento);
        return t > 0 && t < agora;
      });

      const leadIds = Array.from(
        new Set(atrasadasBrutas.map((r: any) => Number((r as any).lead_id)).filter((n: number) => Number.isFinite(n) && n > 0))
      );

      const membroIds = Array.from(
        new Set(atrasadasBrutas.map((r: any) => (r as any).membro_id).filter(Boolean))
      ) as string[];

      let leadsMap: Record<number, { lead_nome_pessoa: string | null; lead_nome_oportunidade: string | null }> = {};
      if (leadIds.length > 0) {
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads_v2')
          .select('lead_id, lead_nome_pessoa, lead_nome_oportunidade')
          .in('lead_id', leadIds);
        if (!leadsError && leadsData) {
          for (const row of leadsData as any[]) {
            leadsMap[Number(row.lead_id)] = {
              lead_nome_pessoa: row.lead_nome_pessoa ? String(row.lead_nome_pessoa) : null,
              lead_nome_oportunidade: row.lead_nome_oportunidade ? String(row.lead_nome_oportunidade) : null,
            };
          }
        }
      }

      let membrosMap: Record<string, string> = {};
      if (membroIds.length > 0) {
        const { data: membrosData, error: membrosError } = await supabase
          .from('membros_v2')
          .select('membro_id, membro_nome')
          .in('membro_id', membroIds);
        if (!membrosError && membrosData) {
          for (const row of membrosData as any[]) {
            membrosMap[String(row.membro_id)] = String(row.membro_nome ?? '');
          }
        }
      }

      const tarefasMapeadas: TarefaAtrasada[] = atrasadasBrutas
        .map((r: any): TarefaAtrasada => {
          const row = r as any;
          const lid = Number(row.lead_id);
          const leadInfo = leadsMap[lid];
          return {
            tarefa_id: String(row.tarefa_id),
            tarefa_titulo: String(row.tarefa_titulo ?? ''),
            tarefa_descricao: row.tarefa_descricao != null ? String(row.tarefa_descricao) : null,
            lead_id: lid,
            lead_nome: leadInfo?.lead_nome_pessoa ?? null,
            lead_oportunidade: leadInfo?.lead_nome_oportunidade ?? null,
            membro_nome: row.membro_id
              ? (membrosMap[String(row.membro_id)] ?? null)
              : (user?.nome ?? null),
            data_vencimento: String(row.data_vencimento ?? ''),
            criado_em: String(row.criado_em ?? ''),
          };
        })
        .sort((a, b) => parseTimestamp(a.data_vencimento) - parseTimestamp(b.data_vencimento));

      console.log(`[Layout][tarefas-atrasadas][${correlationId}] Encontradas ${tarefasMapeadas.length} tarefas atrasadas.`);
      setTarefasAtrasadas(tarefasMapeadas);
    } catch (err: any) {
      console.error(`[Layout][tarefas-atrasadas][${correlationId}] Exception:`, err?.message || err);
      setTarefasAtrasadas([]);
    } finally {
      setLoadingTarefas(false);
    }
  }, [billingOwnerUserId, user?.nome]);

  useEffect(() => {
    buscarTarefasAtrasadas();
  }, [buscarTarefasAtrasadas]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!billingOwnerUserId) {
        if (!cancelled) setPlanStatus(null);
        return;
      }

      const { data, error } = await supabase
        .from('usuarios_v2')
        .select('plano_status')
        .eq('user_id', billingOwnerUserId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setPlanStatus(null);
        return;
      }

      setPlanStatus(String((data as any).plano_status || '').trim() || null);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [billingOwnerUserId]);

  const isPaymentOverdue = planStatus === 'Em atraso';

  useEffect(() => {
    if (!isNotificationsOpen) return;
    const interval = window.setInterval(() => {
      buscarTarefasAtrasadas();
    }, 30 * 1000);
    return () => window.clearInterval(interval);
  }, [isNotificationsOpen, buscarTarefasAtrasadas]);

  const toggleNotifications = () => {
    setIsNotificationsOpen((prev) => {
      const next = !prev;
      if (next) {
        buscarTarefasAtrasadas();
      }
      return next;
    });
  };

  const navigateToLead = (leadId: number) => {
    if (!leadId) return;
    setIsNotificationsOpen(false);
    navigate(`/lead/${leadId}`);
  };

  const formatLocalDmy = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const computeNextDueDate = (dueDayRaw: number, now: Date) => {
    const dueDay = Number(dueDayRaw);
    if (!Number.isFinite(dueDay) || dueDay <= 0) return null;

    const clampToMonth = (year: number, monthIndex: number, day: number) => {
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const safeDay = Math.min(Math.max(1, day), lastDay);
      return new Date(year, monthIndex, safeDay);
    };

    const year = now.getFullYear();
    const month = now.getMonth();
    const todayNoTime = new Date(year, month, now.getDate());

    let nextDue = clampToMonth(year, month, dueDay);
    if (nextDue < todayNoTime) {
      const nextMonth = new Date(year, month + 1, 1);
      nextDue = clampToMonth(nextMonth.getFullYear(), nextMonth.getMonth(), dueDay);
    }

    return { nextDue, todayNoTime };
  };

  const dismissedKey = useMemo(() => {
    if (!user?.id || !pixNextDueDate) return null;
    const y = pixNextDueDate.getFullYear();
    const m = String(pixNextDueDate.getMonth() + 1).padStart(2, '0');
    const d = String(pixNextDueDate.getDate()).padStart(2, '0');
    return `pix-reminder-dismissed:${user.id}:${y}-${m}-${d}`;
  }, [pixNextDueDate, user?.id]);

  useEffect(() => {
    const run = async () => {
      if (!billingOwnerUserId) return;

      const { data, error } = await supabase
        .from('usuarios_v2')
        .select('cartao_token,dia_vencimento,id_assinatura_asaas')
        .eq('user_id', billingOwnerUserId)
        .maybeSingle();

      if (error || !data) return;

      const token = String((data as any).cartao_token || '').trim().toUpperCase();
      const dueDay = Number((data as any).dia_vencimento);
      const subscriptionId = String((data as any).id_assinatura_asaas || '').trim() || null;

      if (token !== 'PIX' || !Number.isFinite(dueDay) || dueDay <= 0) {
        setShowPixReminder(false);
        return;
      }

      const computed = computeNextDueDate(dueDay, new Date());
      if (!computed) {
        setShowPixReminder(false);
        return;
      }

      const diffMs = computed.nextDue.getTime() - computed.todayNoTime.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      setPixDueDay(dueDay);
      setPixNextDueDate(computed.nextDue);
      setPixSubscriptionId(subscriptionId);

      const key = `pix-reminder-dismissed:${user.id}:${computed.nextDue.getFullYear()}-${String(computed.nextDue.getMonth() + 1).padStart(2, '0')}-${String(computed.nextDue.getDate()).padStart(2, '0')}`;
      const dismissed = localStorage.getItem(key) === '1';

      const shouldConsiderShowing = !dismissed && diffDays >= 0 && diffDays <= 7;
      if (!shouldConsiderShowing) {
        setShowPixReminder(false);
        return;
      }

      if (!subscriptionId) {
        setShowPixReminder(false);
        return;
      }

      const apiKey = getAsaasApiKey();
      if (!apiKey) {
        setShowPixReminder(false);
        return;
      }

      const paymentsResp = await asaasFetch(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?limit=20`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          access_token: apiKey,
        },
      });

      const paymentsJson = await paymentsResp.json().catch(() => null);
      const list = paymentsJson?.data;

      const parseAsaasDueDate = (value: unknown) => {
        const raw = String(value || '').trim();
        const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const [, year, month, day] = match;
        return new Date(Number(year), Number(month) - 1, Number(day));
      };

      const maxReminderDate = new Date(computed.todayNoTime);
      maxReminderDate.setDate(maxReminderDate.getDate() + 7);

      const hasPending = Array.isArray(list)
        ? list.some((p: any) => {
            const status = String(p?.status || '').toUpperCase();
            if (!['PENDING', 'OVERDUE'].includes(status)) return false;

            const dueDate = parseAsaasDueDate(p?.dueDate);
            if (!dueDate) return false;

            return dueDate.getTime() <= maxReminderDate.getTime();
          })
        : false;
      setShowPixReminder(hasPending);
    };

    run();
  }, [billingOwnerUserId, user?.id]);

  useEffect(() => {
    if (needsNpsSurvey) {
      setNpsError('');
      setIsSubmittingNps(false);
      setNpsSuporte(null);
      setNpsIa(null);
      setNpsPadrao(null);
      setNpsStep(0);
    }
  }, [needsNpsSurvey]);

  useEffect(() => {
    const onFocus = () => pingSharedSession();
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => {
      pingSharedSession();
      const novaSessao = getSharedSessionId();
      if (novaSessao !== comunicadoSessionStorageSyncRef.sessionId) {
        console.log('[Comunicados] Sessão compartilhada renovada:', novaSessao);
        comunicadoSessionStorageSyncRef.sessionId = novaSessao;
      }
    }, 60 * 1000);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [comunicadoSessionStorageSyncRef]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user?.id) return;
      if (user.tipo === 'Outros') return;
      if (needsNpsSurvey) return;
      if (showComunicado) return;

      const comunicado = await fetchActiveComunicado();
      if (!comunicado || cancelled) return;

      if (foiMostradoNaSessaoAtual(comunicado.comunicado_id)) {
        console.log('[Comunicados] Já mostrado nesta sessão compartilhada, ignorando.');
        return;
      }

      const regraNegocio = billingOwnerUserId
        ? await comunicadoDeveMostrarParaUsuario(comunicado.comunicado_id, billingOwnerUserId)
        : { deveMostrar: true };
      if (cancelled) return;

      if (!regraNegocio.deveMostrar) {
        marcarMostradoNaSessaoAtual(comunicado.comunicado_id);
        return;
      }

      const historico = await fetchHistoricoByUserAndComunicado(user.id, comunicado.comunicado_id);
      if (cancelled) return;

      if (!deveMostrarComunicado(comunicado, historico)) {
        marcarMostradoNaSessaoAtual(comunicado.comunicado_id);
        return;
      }

      marcarMostradoNaSessaoAtual(comunicado.comunicado_id);
      setCurrentComunicado(comunicado);
      setShowComunicado(true);

      await upsertHistoricoIncrementView(user.id, comunicado.comunicado_id);
    };

    run();

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key) return;
      if (e.key.startsWith('comunicado_sessao_mostrada:') && currentComunicado) {
        if (foiMostradoNaSessaoAtual(currentComunicado.comunicado_id) && showComunicado) {
          /* Outra aba já mostrou — mantemos a nossa aberta pois o usuário já está vendo,
             mas não disparamos a pipeline novamente no re-mount. */
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      cancelled = true;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user?.id, user?.tipo, needsNpsSurvey, showComunicado, currentComunicado, comunicadoSessionStorageSyncRef, billingOwnerUserId]);

  const handleCloseComunicado = async (naoMostrarNovamente: boolean) => {
    if (naoMostrarNovamente && currentComunicado && user?.id) {
      await updateHistoricoOcultar(user.id, currentComunicado.comunicado_id);
    }
    setShowComunicado(false);
  };

  const renderNpsScale = (params: { name: string; value: number | null; onChange: (v: number) => void }) => {
    return (
      <div className="wl-nps" role="radiogroup" aria-label="Nota de 0 a 10">
        {Array.from({ length: 11 }).map((_, i) => (
          <button
            key={`${params.name}-${i}`}
            type="button"
            role="radio"
            aria-checked={params.value === i}
            className={`wl-nps__dot${params.value === i ? ' is-on' : ''}`}
            onClick={() => params.onChange(i)}
          >
            {i}
          </button>
        ))}
      </div>
    );
  };

  const dismissReminder = () => {
    if (dismissedKey) {
      localStorage.setItem(dismissedKey, '1');
    }
    setShowPixReminder(false);
  };

  const fetchPixQr = async () => {
    if (!pixSubscriptionId) {
      toast.error('Assinatura não identificada.');
      return;
    }

    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      toast.error('Chave do Asaas não configurada.');
      return;
    }

    setIsLoadingPixQr(true);
    try {
      const paymentsResp = await asaasFetch(`/subscriptions/${encodeURIComponent(pixSubscriptionId)}/payments?limit=20`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          access_token: apiKey,
        },
      });

      const paymentsJson = await paymentsResp.json().catch(() => null);
      const list = paymentsJson?.data;
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('Nenhuma cobrança PIX encontrada para a assinatura.');
      }

      const pick = (items: any[]) => {
        const relevant = items.filter((p) => ['PENDING', 'OVERDUE'].includes(String(p?.status || '').toUpperCase()));
        if (relevant.length === 0) return items[0];

        const toTime = (value: any) => {
          const raw = String(value || '').trim();
          if (!raw) return Number.POSITIVE_INFINITY;
          const time = new Date(raw).getTime();
          return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
        };

        return [...relevant].sort((a, b) => {
          const dueDiff = toTime(a?.dueDate) - toTime(b?.dueDate);
          if (dueDiff !== 0) return dueDiff;
          return String(a?.id || '').localeCompare(String(b?.id || ''));
        })[0];
      };

      const payment = pick(list);
      const paymentId = String(payment?.id || '').trim();
      if (!paymentId) throw new Error('Cobrança PIX não identificada.');

      const qrResp = await asaasFetch(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          access_token: apiKey,
        },
      });

      if (!qrResp.ok) {
        const err = await qrResp.json().catch(() => null);
        throw new Error(err?.errors?.[0]?.description || 'Não foi possível obter o QR Code.');
      }

      const qrJson = await qrResp.json().catch(() => null);
      const encodedImage = String(qrJson?.encodedImage || '').trim();
      const payload = String(qrJson?.payload || '').trim();
      if (!encodedImage || !payload) throw new Error('QR Code inválido.');

      setPixQrData({ encodedImage, payload, paymentId });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar PIX.');
    } finally {
      setIsLoadingPixQr(false);
    }
  };

  const openPixQr = async () => {
    dismissReminder();
    setShowPixQr(true);
    if (!pixQrData) {
      await fetchPixQr();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        onToggleNotifications={toggleNotifications}
        unreadCount={(demoTarefas ?? tarefasAtrasadas).length}
        isNotificationsOpen={isNotificationsOpen}
      />
      <NotificationPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        tarefas={demoTarefas ?? tarefasAtrasadas}
        loading={loadingTarefas}
        onNavigateToLead={navigateToLead}
        onRefresh={buscarTarefasAtrasadas}
      />
      <main className="main-content">
        {(isPaymentOverdue || demo.includes('atraso')) && (
          <div className="wl-scope">
            <div className="wl-banner" role="alert">
              <span className="wl-banner__icon"><AlertTriangle aria-hidden="true" /></span>
              <div className="wl-banner__text">
                <p className="wl-banner__title">Pagamento em atraso</p>
                <p className="wl-banner__desc">
                  Sua fatura está pendente e o atendimento da Julia para novos leads está pausado. Faça o pagamento para reativar!
                </p>
              </div>
              <button type="button" className="wl-btn wl-btn--lime wl-btn--sm" onClick={() => navigate('/configuracoes?aba=assinatura')}>
                Fazer pagamento
              </button>
            </div>
          </div>
        )}
        {children}
      </main>

      {(needsNpsSurvey || demo.includes('nps')) && (
        <div className="wl-scope wl-overlay wl-overlay--top" role="dialog" aria-modal="true" aria-labelledby="nps-titulo">
          <div className="wl-modal wl-modal--md wl-overlay__card">
            <header className="wl-modal__head">
              <p className="wl-eyebrow">Pesquisa de satisfação · {npsStep + 1} de 3</p>
              <h2 id="nps-titulo" className="wl-title wl-title--sm">Pesquisa de Satisfação</h2>
              <p className="wl-lede">Envie a pesquisa para continuar usando o painel.</p>
            </header>

            <div className="wl-modal__stack">
              {npsError ? <p className="wl-alert" role="alert">{npsError}</p> : null}

              {npsStep === 0 ? (
                <>
                  <p className="wl-nps__q">
                    De 0 a 10, como você avalia a rapidez e a eficiência do time da WORKLIVOO em resolver a sua solicitação?
                  </p>
                  {renderNpsScale({ name: 'nps_suporte', value: npsSuporte, onChange: setNpsSuporte })}
                </>
              ) : null}

              {npsStep === 1 ? (
                <>
                  <p className="wl-nps__q">
                    De 0 a 10, como você avalia o desempenho das conversas da IA com os seus clientes?
                  </p>
                  {renderNpsScale({ name: 'nps_ia', value: npsIa, onChange: setNpsIa })}
                </>
              ) : null}

              {npsStep === 2 ? (
                <>
                  <p className="wl-nps__q">
                    De 0 a 10, qual a probabilidade de você recomendar a WORKLIVOO para outras pessoas?
                  </p>
                  {renderNpsScale({ name: 'nps_padrao', value: npsPadrao, onChange: setNpsPadrao })}
                </>
              ) : null}
            </div>

            <div className="wl-modal__foot wl-modal__foot--end">
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                disabled={isSubmittingNps || npsStep === 0}
                onClick={() => setNpsStep((s) => Math.max(0, s - 1))}
              >
                Voltar
              </button>

              {npsStep < 2 ? (
                <button
                  type="button"
                  className="wl-btn wl-btn--lime"
                  disabled={
                    isSubmittingNps ||
                    (npsStep === 0 && npsSuporte === null) ||
                    (npsStep === 1 && npsIa === null)
                  }
                  onClick={() => setNpsStep((s) => Math.min(2, s + 1))}
                >
                  Próxima
                </button>
              ) : (
                <button
                  type="button"
                  className="wl-btn wl-btn--lime"
                  disabled={isSubmittingNps || npsSuporte === null || npsIa === null || npsPadrao === null}
                  onClick={async () => {
                    setIsSubmittingNps(true);
                    setNpsError('');
                    const result = await submitNps({
                      nps_suporte: npsSuporte ?? -1,
                      nps_ia: npsIa ?? -1,
                      nps_padrao: npsPadrao ?? -1,
                    });
                    if (!result.success) {
                      setNpsError(result.error || 'Não foi possível enviar o NPS. Tente novamente.');
                      setIsSubmittingNps(false);
                    }
                  }}
                >
                  {isSubmittingNps ? 'Enviando...' : 'Enviar NPS'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {(showPixReminder || demo.includes('pix,') || demo.endsWith('pix')) && (
        <div className="wl-scope wl-overlay" role="dialog" aria-modal="true" aria-labelledby="pix-lembrete-titulo">
          <div className="wl-modal wl-modal--md wl-overlay__card">
            <button type="button" className="wl-iconbtn wl-overlay__close" onClick={dismissReminder} aria-label="Fechar">
              <X aria-hidden="true" />
            </button>
            <header className="wl-modal__head">
              <h2 id="pix-lembrete-titulo" className="wl-title wl-title--sm">PIX gerado</h2>
              <p className="wl-lede">
                {pixDueDay ? `Vencimento dia ${pixDueDay}` : 'Vencimento'}
                {pixNextDueDate ? ` · ${formatLocalDmy(pixNextDueDate)}` : ''}
              </p>
            </header>

            <p className="wl-lede">
              Você tem um pagamento via PIX pendente. Clique abaixo para visualizar o QR Code e copiar o código.
            </p>

            <div className="wl-modal__foot wl-modal__foot--end">
              <button type="button" className="wl-btn wl-btn--glass-ink" onClick={dismissReminder}>
                Fechar
              </button>
              <button type="button" className="wl-btn wl-btn--lime" onClick={openPixQr}>
                <QrCode aria-hidden="true" width={16} height={16} />
                Ver PIX
              </button>
            </div>
          </div>
        </div>
      )}

      {(showPixQr || demo.includes('pixqr')) && (
        <div className="wl-scope wl-overlay wl-overlay--up" role="dialog" aria-modal="true" aria-labelledby="pix-qr-titulo">
          <div className="wl-modal wl-modal--md wl-overlay__card">
            <button type="button" className="wl-iconbtn wl-overlay__close" onClick={() => setShowPixQr(false)} aria-label="Fechar">
              <X aria-hidden="true" />
            </button>
            <header className="wl-modal__head">
              <h2 id="pix-qr-titulo" className="wl-title wl-title--sm">PIX</h2>
              <p className="wl-lede">Escaneie o QR Code ou copie o código.</p>
            </header>

            {isLoadingPixQr ? (
              <p className="wl-clist__note wl-clist__note--center" role="status">Carregando PIX...</p>
            ) : pixQrData ? (
              <div className="wl-modal__stack">
                <div className="wl-pay__qr" style={{ margin: '0 auto' }}>
                  <img alt="QR Code PIX" src={`data:image/png;base64,${pixQrData.encodedImage}`} />
                </div>

                <div className="wl-set-box">
                  <span className="wl-label">Código PIX</span>
                  <span className="wl-kv__value wl-kv__value--mono">{pixQrData.payload}</span>
                  <button
                    type="button"
                    className="wl-btn wl-btn--glass-ink wl-btn--block"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pixQrData.payload);
                        toast.success('Código PIX copiado!');
                      } catch {
                        toast.error('Não foi possível copiar o código.');
                      }
                    }}
                  >
                    <Copy aria-hidden="true" width={15} height={15} />
                    Copiar código
                  </button>
                </div>
              </div>
            ) : (
              <p className="wl-alert" role="alert">Não foi possível carregar o PIX.</p>
            )}
          </div>
        </div>
      )}

      {(demo.includes('comunicado') || (showComunicado && currentComunicado)) && (
        <ComunicadoModal
          comunicado={currentComunicado ?? demoComunicado}
          onClose={handleCloseComunicado}
        />
      )}
    </div>
  );
};

export default Layout; 
