import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import './Sidebar.css';
import { AlertTriangle, Copy, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';
import { useCRM } from '@/contexts/CRMContext';
import { supabase } from '@/lib/supabase';
import { asaasFetch, getAsaasApiKey } from '@/utils/asaas';
import ComunicadoModal from '@/components/ComunicadoModal';
import { NotificationPanel } from '@/components/NotificationPanel';
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
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={`${params.name}-label-${i}`} className="w-7 text-center text-xs font-bold text-gray-700">
              {i}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {Array.from({ length: 11 }).map((_, i) => {
            const selected = params.value === i;
            return (
              <button
                key={`${params.name}-${i}`}
                type="button"
                aria-label={`${i}`}
                className={[
                  'w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
                  selected ? 'border-black bg-black' : 'border-gray-400 bg-white hover:border-gray-600',
                ].join(' ')}
                onClick={() => params.onChange(i)}
              >
                <span className={selected ? 'w-3 h-3 rounded-full bg-[#EBF57D]' : 'w-3 h-3 rounded-full bg-transparent'} />
              </button>
            );
          })}
        </div>
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
        unreadCount={tarefasAtrasadas.length}
        isNotificationsOpen={isNotificationsOpen}
      />
      <NotificationPanel
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        tarefas={tarefasAtrasadas}
        loading={loadingTarefas}
        onNavigateToLead={navigateToLead}
        onRefresh={buscarTarefasAtrasadas}
      />
      <main className="main-content">
        {children}
      </main>

      {needsNpsSurvey && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-[24px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#EBF57D] flex items-center justify-center text-black">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div className="text-lg font-black text-black">Pesquisa de Satisfação</div>
                  <div className="text-sm text-gray-500">Envie a pesquisa para continuar usando o painel</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              {npsError ? (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm font-bold text-red-700">{npsError}</div>
                </div>
              ) : null}

              <div>
                {npsStep === 0 ? (
                  <>
                    <div className="text-sm font-bold text-gray-800">
                      De 0 a 10, como você avalia a rapidez e a eficiência do time da WORKLIVOO em resolver a sua solicitação?
                    </div>
                    {renderNpsScale({ name: 'nps_suporte', value: npsSuporte, onChange: setNpsSuporte })}
                  </>
                ) : null}

                {npsStep === 1 ? (
                  <>
                    <div className="text-sm font-bold text-gray-800">
                      De 0 a 10, como você avalia o desempenho das conversas da IA com os seus clientes?
                    </div>
                    {renderNpsScale({ name: 'nps_ia', value: npsIa, onChange: setNpsIa })}
                  </>
                ) : null}

                {npsStep === 2 ? (
                  <>
                    <div className="text-sm font-bold text-gray-800">
                      De 0 a 10, qual a probabilidade de você recomendar a WORKLIVOO para outras pessoas?
                    </div>
                    {renderNpsScale({ name: 'nps_padrao', value: npsPadrao, onChange: setNpsPadrao })}
                  </>
                ) : null}
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60 disabled:hover:bg-transparent"
                  disabled={isSubmittingNps || npsStep === 0}
                  onClick={() => setNpsStep((s) => Math.max(0, s - 1))}
                >
                  Voltar
                </button>

                {npsStep < 2 ? (
                  <button
                    type="button"
                    className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#EBF57D] text-black hover:bg-[#e3ef62] transition-all flex items-center justify-center disabled:opacity-60 disabled:hover:bg-[#EBF57D]"
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
                    className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#EBF57D] text-black hover:bg-[#e3ef62] transition-all flex items-center justify-center disabled:opacity-60 disabled:hover:bg-[#EBF57D]"
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
        </div>
      )}

      {showPixReminder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-[24px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-[#EBF57D] flex items-center justify-center text-black">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div className="text-lg font-black text-black">PIX Gerado</div>
                  <div className="text-sm text-gray-500">
                    {pixDueDay ? `Vencimento dia ${pixDueDay}` : 'Vencimento'}
                    {pixNextDueDate ? ` • ${formatLocalDmy(pixNextDueDate)}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                onClick={dismissReminder}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6">
              <p className="text-base text-gray-700 leading-relaxed">
                Você tem um pagamento via PIX pendente. Clique abaixo para visualizar o QR Code e copiar o código.
              </p>

              <div className="mt-6 flex gap-4">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                  onClick={dismissReminder}
                >
                  Fechar
                </button>
                <button
                  type="button"
                  className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#EBF57D] text-black hover:bg-[#e3ef62] transition-all flex items-center justify-center gap-2"
                  onClick={openPixQr}
                >
                  <QrCode size={18} />
                  Ver PIX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPixQr && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-[24px] bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-black/5 flex items-center justify-center text-black">
                  <QrCode size={18} />
                </div>
                <div className="text-lg font-black text-black">PIX</div>
              </div>
              <button
                type="button"
                className="h-9 w-9 rounded-full hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                onClick={() => setShowPixQr(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-6">
              {isLoadingPixQr ? (
                <div className="text-sm font-bold text-gray-500">Carregando PIX...</div>
              ) : pixQrData ? (
                <>
                  <div className="flex items-center justify-center">
                    <img
                      alt="QR Code PIX"
                      className="w-64 h-64 rounded-2xl border border-gray-100"
                      src={`data:image/png;base64,${pixQrData.encodedImage}`}
                    />
                  </div>

                  <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Código PIX</div>
                    <div className="text-xs font-bold text-gray-700 break-all">{pixQrData.payload}</div>
                    <button
                      type="button"
                      className="mt-4 w-full py-3 rounded-2xl text-sm font-bold bg-black text-white hover:bg-black/90 transition-all flex items-center justify-center gap-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(pixQrData.payload);
                          toast.success('Código PIX copiado!');
                        } catch {
                          toast.error('Não foi possível copiar o código.');
                        }
                      }}
                    >
                      <Copy size={16} />
                      Copiar código
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-sm font-bold text-gray-500">Não foi possível carregar o PIX.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {showComunicado && currentComunicado && (
        <ComunicadoModal
          comunicado={currentComunicado}
          onClose={handleCloseComunicado}
        />
      )}
    </div>
  );
};

export default Layout; 
