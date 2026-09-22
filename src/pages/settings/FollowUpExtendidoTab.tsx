import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { asaasFetch, getAsaasApiKey, shouldRequireAsaasApiKey } from '@/utils/asaas';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Crown, Database, History, User, Zap, Clock, Sparkles, ArrowRightLeft, BarChart3, XCircle, CheckCircle2, ArrowRight, ArrowDown, ExternalLink } from 'lucide-react';
import { formatPhone } from '@/lib/lead-detail-utils';
import { PIPELINE_STAGES } from '@/lib/lead-detail-constants';

interface FollowUpExtendidoTabProps {
  user: any;
  settingsOwnerUserId: string | null;
}

type FollowUpExtendidoPagamentoStatus = 'PENDING' | 'RECEIVED' | 'CANCELLED' | 'EXPIRED';

interface FollowUpExtendidoCicloInfo {
  inicio: string;
  fim: string;
  diaVencimento: number;
  diasRestantes: number;
}

interface FollowUpExtendidoPixInfo {
  payload: string;
  base64?: string | null;
  qrCodeImageUrl?: string | null;
  expirationDate?: string | null;
}

interface FollowUpExtendidoPagamento {
  paymentId: string;
  externalReference: string;
  status: FollowUpExtendidoPagamentoStatus;
  planoId: string;
  valorRateio: number;
  valorPlanoCheio: number;
  valorProxFatura: number;
  ciclo: FollowUpExtendidoCicloInfo;
  pix: FollowUpExtendidoPixInfo;
  createdAt: number;
  lastPolledAt?: number | null;
  completedAt?: number | null;
  pipelineExecutado?: boolean;
  pipelineErro?: string | null;
  dadosCliente?: {
    nome?: string;
    empresa?: string;
  };
}

const STORAGE_PREFIX = 'fu_extendido_pagamento_';
const STORAGE_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24h
const DEBUG_TAG = 'FU Extendido Storage';

const getStorageKey = (userId: string | null | undefined): string | null => {
  if (!userId) return null;
  return `${STORAGE_PREFIX}${String(userId)}`;
};

const savePagamentoToStorage = (
  userId: string | null | undefined,
  data: FollowUpExtendidoPagamento,
): void => {
  const key = getStorageKey(userId);
  if (!key) return;
  try {
    const serialized = JSON.stringify(data);
    window.localStorage.setItem(key, serialized);
    console.debug(`[${DEBUG_TAG}] save -> key=${key}; externalRef=${data.externalReference}; status=${data.status}`);
  } catch (err) {
    console.error(`[${DEBUG_TAG}] save FAILED -> key=${key}`, err);
  }
};

const loadPagamentoFromStorage = (
  userId: string | null | undefined,
): FollowUpExtendidoPagamento | null => {
  const key = getStorageKey(userId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      console.debug(`[${DEBUG_TAG}] load -> key=${key}; payload=VAZIO`);
      return null;
    }
    const parsed = JSON.parse(raw) as FollowUpExtendidoPagamento;
    const ageMs = Date.now() - (parsed.createdAt ?? 0);
    if (ageMs > STORAGE_EXPIRE_MS) {
      console.warn(
        `[${DEBUG_TAG}] load -> expirado (idade=${Math.round(ageMs / 1000 / 60)}min > 24h). Limpando. externalRef=${parsed.externalReference}`,
      );
      window.localStorage.removeItem(key);
      return null;
    }

    // 🔴 NÃO apagamos pagamento CONFIRMADO (RECEIVED) se AINDA NÃO rodou o pipeline.
    //    Motivo: usuário pode ter recarregado a página durante a animação de sucesso,
    //    e o pipeline de ativação (UPDATE usuarios_v2 + PUT assinatura Asaas) nunca rodou.
    //    Nesse caso, retornamos o pagamento para rodar o pipeline NA HORA no useEffect de restore.
    const recebidoSemPipeline =
      parsed.status === 'RECEIVED' && parsed.pipelineExecutado !== true;

    if (parsed.status === 'RECEIVED' && parsed.pipelineExecutado === true) {
      console.debug(
        `[${DEBUG_TAG}] load -> pagamento ja concluido COM pipeline executado. Limpando. externalRef=${parsed.externalReference}`,
      );
      window.localStorage.removeItem(key);
      return null;
    }

    if (parsed.status === 'CANCELLED' || parsed.status === 'EXPIRED') {
      console.debug(
        `[${DEBUG_TAG}] load -> pagamento final sem sucesso (status=${parsed.status}). Limpando. externalRef=${parsed.externalReference}`,
      );
      window.localStorage.removeItem(key);
      return null;
    }

    console.debug(
      `[${DEBUG_TAG}] load -> ok key=${key}; externalRef=${parsed.externalReference}; status=${parsed.status}; pipelineExecutado=${parsed.pipelineExecutado === true}; idade=${Math.round(ageMs / 1000 / 60)}min`,
    );
    return parsed;
  } catch (err) {
    console.error(`[${DEBUG_TAG}] load FAILED -> key=${key}. Limpando.`, err);
    try {
      window.localStorage.removeItem(key);
    } catch (_) {
      /* noop */
    }
    return null;
  }
};

const clearPagamentoFromStorage = (userId: string | null | undefined): void => {
  const key = getStorageKey(userId);
  if (!key) return;
  try {
    window.localStorage.removeItem(key);
    console.debug(`[${DEBUG_TAG}] clear -> key=${key}`);
  } catch (err) {
    console.error(`[${DEBUG_TAG}] clear FAILED -> key=${key}`, err);
  }
};

export const FollowUpExtendidoTab: React.FC<FollowUpExtendidoTabProps> = ({
  user,
  settingsOwnerUserId,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Só vira false quando o componente desmonta de verdade — usado pelo timer de
  // fechamento automático do dialog, que não pode depender do `cancelled` local
  // do efeito de polling (esse é derrubado pelo próprio polling ao confirmar o
  // pagamento, antes do timer disparar, fazendo o dialog nunca fechar sozinho).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const [followupExtendidoAtivo, setFollowupExtendidoAtivo] = useState<boolean>(false);
  const [followupExtendidoVolume, setFollowupExtendidoVolume] = useState<string>('');
  const [followupExtendidoDiasPerdidos, setFollowupExtendidoDiasPerdidos] = useState<string>('');
  const [followupExtendidoEtapas, setFollowupExtendidoEtapas] = useState<string[]>([]);
  const [loadingFollowupExtendidoConfig, setLoadingFollowupExtendidoConfig] = useState<boolean>(false);
  const [isSavingFollowupExtendidoConfig, setIsSavingFollowupExtendidoConfig] = useState<boolean>(false);
  const [isEditingFollowupExtendidoDias, setIsEditingFollowupExtendidoDias] = useState<boolean>(false);
  const [isEditingFollowupExtendidoEtapas, setIsEditingFollowupExtendidoEtapas] = useState<boolean>(false);
  const [followupExtendidoHistorico, setFollowupExtendidoHistorico] = useState<any[]>([]);
  const [loadingFollowupExtendidoHistorico, setLoadingFollowupExtendidoHistorico] = useState<boolean>(false);

  const [userPagamentoConfig, setUserPagamentoConfig] = useState<{
    id_cliente_asaas: string;
    id_assinatura_asaas: string;
    dia_vencimento: string;
    user_valor_mensal: number;
    user_nome?: string;
    user_empresa?: string;
  } | null>(null);

  const [isAcquireDialogOpen, setIsAcquireDialogOpen] = useState<boolean>(false);
  const [acquireStep, setAcquireStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isAdvancingToStep3, setIsAdvancingToStep3] = useState<boolean>(false);

  const [pagamentoAtivo, setPagamentoAtivo] = useState<FollowUpExtendidoPagamento | null>(null);
  const [isCreatingQrCode, setIsCreatingQrCode] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isPollingPagamento, setIsPollingPagamento] = useState<boolean>(false);
  const [pagamentoConfirmadoUI, setPagamentoConfirmadoUI] = useState<boolean>(false);

  const plans = useMemo(() => {
    const list = [
      {
        id: 'essencial',
        nome: 'Essencial',
        volume: 40,
        preco: 99,
        descricao: 'Ideal para quem está começando a reengajar leads sem resposta.',
      },
      {
        id: 'pro',
        nome: 'Pro',
        volume: 100,
        preco: 190,
        descricao: 'Perfeito para equipes que recebem muitas oportunidades novas.',
        recomendado: true,
      },
      {
        id: 'empresarial',
        nome: 'Empresarial',
        volume: 300,
        preco: 490,
        descricao: 'Alto volume para empresas com base grande de leads.',
      },
    ];
    console.debug('[FU Extendido Init] Planos carregados (precos R$ 99, R$ 190, R$ 490):', list.map(p => `${p.id} R$${p.preco} / ${p.volume} reativacoes`));
    return list;
  }, []);

  const selectedPlan = useMemo(() => {
    return plans.find(p => p.id === selectedPlanId) ?? null;
  }, [plans, selectedPlanId]);

  const planoProrrateado = useMemo(() => {
    if (!selectedPlan) return null;

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();

    const rawVencStr =
      userPagamentoConfig?.dia_vencimento?.trim() ||
      String(user?.dia_vencimento ?? '').trim();
    const rawVenc = Number(String(rawVencStr).replace(/\D/g, ''));
    const vencimento = Number.isFinite(rawVenc) && rawVenc > 0 ? rawVenc : 5;

    const ultimoDiaMesAtual = new Date(anoAtual, mesAtual + 1, 0).getDate();
    const ultimoDiaMesAnterior = new Date(anoAtual, mesAtual, 0).getDate();

    const diaVencAjustadoMesAnterior = Math.min(vencimento, ultimoDiaMesAnterior);
    const diaVencAjustadoProximo = Math.min(vencimento, ultimoDiaMesAtual);

    let dataInicioCiclo: Date;
    let dataFimCiclo: Date;

    if (hoje.getDate() >= diaVencAjustadoProximo) {
      dataInicioCiclo = new Date(anoAtual, mesAtual, diaVencAjustadoProximo);
      dataFimCiclo = new Date(anoAtual, mesAtual + 1, Math.min(vencimento, new Date(anoAtual, mesAtual + 2, 0).getDate()));
    } else {
      dataInicioCiclo = new Date(anoAtual, mesAtual - 1, diaVencAjustadoMesAnterior);
      dataFimCiclo = new Date(anoAtual, mesAtual, diaVencAjustadoProximo);
    }

    const msPorDia = 1000 * 60 * 60 * 24;
    const totalDiasCiclo = Math.max(1, Math.round((dataFimCiclo.getTime() - dataInicioCiclo.getTime()) / msPorDia));
    const diasRestantes = Math.max(1, Math.round((dataFimCiclo.getTime() - hoje.getTime()) / msPorDia));

    const valorDiario = selectedPlan.preco / totalDiasCiclo;
    const valorRateioCalculado = Number((valorDiario * diasRestantes).toFixed(2));
    // O Asaas rejeita cobranças PIX abaixo de R$5,00 — sem essa trava, um rateio
    // pequeno (ex: contratar 1 dia antes do vencimento) falha ao gerar o QR Code.
    const ASAAS_VALOR_MINIMO_COBRANCA = 5;
    const valorRateio = Math.max(ASAAS_VALOR_MINIMO_COBRANCA, valorRateioCalculado);
    const valorRateioAjustadoParaMinimo = valorRateio > valorRateioCalculado;
    const valorProxFatura = selectedPlan.preco;

    const formatarData = (d: Date) =>
      d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return {
      hoje: formatarData(hoje),
      inicioCiclo: formatarData(dataInicioCiclo),
      fimCiclo: formatarData(dataFimCiclo),
      diaVencimento: vencimento,
      totalDiasCiclo,
      diasRestantes,
      valorDiario: Number(valorDiario.toFixed(4)),
      valorRateio,
      valorRateioCalculado,
      valorRateioAjustadoParaMinimo,
      valorProxFatura,
      valorPlanoCheio: selectedPlan.preco,
    };
  }, [selectedPlan, user, userPagamentoConfig?.dia_vencimento]);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFollowupExtendidoConfig(true);
      try {
        const { data, error } = await supabase
          .from('usuarios_v2')
          .select(`
            followup_extendido,
            followup_extendido_volume,
            followup_extendido_dias_perdidos,
            followup_extendido_etapas,
            id_cliente_asaas,
            id_assinatura_asaas,
            dia_vencimento,
            user_valor_mensal,
            user_nome,
            user_empresa
          `)
          .eq('user_id', settingsOwnerUserId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        const d = data as any;

        const ativo = Boolean(d.followup_extendido ?? false);
        const volume =
          d.followup_extendido_volume === null || d.followup_extendido_volume === undefined
            ? ''
            : String(d.followup_extendido_volume);
        const dias =
          d.followup_extendido_dias_perdidos === null || d.followup_extendido_dias_perdidos === undefined
            ? ''
            : String(d.followup_extendido_dias_perdidos);
        const etapas = String(d.followup_extendido_etapas ?? '')
          .split(',')
          .map((etapa: string) => etapa.trim())
          .filter(Boolean);

        setFollowupExtendidoAtivo(ativo);
        setFollowupExtendidoVolume(volume);
        setFollowupExtendidoDiasPerdidos(dias);
        setFollowupExtendidoEtapas(etapas);

        setUserPagamentoConfig({
          id_cliente_asaas: String(d.id_cliente_asaas ?? '').trim(),
          id_assinatura_asaas: String(d.id_assinatura_asaas ?? '').trim(),
          dia_vencimento: String(d.dia_vencimento ?? '').trim(),
          user_valor_mensal: Number(d.user_valor_mensal) || 0,
          user_nome: d.user_nome ?? undefined,
          user_empresa: d.user_empresa ?? undefined,
        });

        console.info('[FU Extendido Init] userPagamentoConfig carregado do banco:', {
          id_cliente_asaas: String(d.id_cliente_asaas ?? '').trim()
            ? `${String(d.id_cliente_asaas ?? '').slice(0, 4)}...${String(d.id_cliente_asaas ?? '').slice(-3)}`
            : '<VAZIO>',
          id_assinatura_asaas: String(d.id_assinatura_asaas ?? '').trim()
            ? `${String(d.id_assinatura_asaas ?? '').slice(0, 4)}...${String(d.id_assinatura_asaas ?? '').slice(-3)}`
            : '<VAZIO>',
          dia_vencimento: d.dia_vencimento,
          user_valor_mensal: d.user_valor_mensal,
        });
      } catch (err: any) {
        console.error('[FollowUp Extendido] Erro ao carregar configuração:', err);
      } finally {
        setLoadingFollowupExtendidoConfig(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  // ===== ETAPA 1.4: Retomada automatica do fluxo pelo localStorage =====
  useEffect(() => {
    if (!settingsOwnerUserId) return;

    const storagePagamento = loadPagamentoFromStorage(settingsOwnerUserId);
    if (!storagePagamento) {
      console.debug('[FU Extendido Restore] Nenhum storage encontrado, seguindo fluxo normal.');
      return;
    }

    // ============================================================
    // CASO 1: Pagamento já foi CONFIRMADO (RECEIVED) mas PIPELINE NÃO RODOU.
    // Isso acontece quando o usuário recarrega a página DURANTE a animação de sucesso
    // (os 3 segundos antes do dialog fechar).
    // AÇÃO: Roda o pipeline NA HORA, mostra animação de sucesso, limpa storage.
    // ============================================================
    if (storagePagamento.status === 'RECEIVED' && storagePagamento.pipelineExecutado !== true) {
      console.groupCollapsed(
        `[FU Extendido Restore] ⚠️ Pagamento RECEIVED sem pipeline! Executando ativação agora. externalRef=${storagePagamento.externalReference}`,
      );
      console.info('pagamento_id:', storagePagamento.paymentId);
      console.info('planoId:', storagePagamento.planoId);
      console.info('valorRateio:', storagePagamento.valorRateio);
      console.groupEnd();

      setPagamentoAtivo(storagePagamento);
      setSelectedPlanId(storagePagamento.planoId);
      setPagamentoConfirmadoUI(true);
      setIsAcquireDialogOpen(true);
      setAcquireStep(3);

      (async () => {
        try {
          const pipelineRes = await executarPipelinePosPagamento(storagePagamento);
          // Salva flag pipelineExecutado no storage (evita rodar 2x em caso de refresh rápido)
          const atualizado: FollowUpExtendidoPagamento = {
            ...storagePagamento,
            completedAt: storagePagamento.completedAt ?? Date.now(),
            pipelineExecutado: pipelineRes.ok,
            pipelineErro: pipelineRes.ok ? null : pipelineRes.erro ?? 'erro_desconhecido',
          };
          savePagamentoToStorage(settingsOwnerUserId, atualizado);

          if (!pipelineRes.ok) {
            toast({
              title: 'Pagamento confirmado!',
              description:
                'Porém houve um erro ao ativar a funcionalidade. Contate o suporte com o código: ' +
                storagePagamento.externalReference,
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Funcionalidade ativada! 🎉',
              description: pipelineRes.guard_clause
                ? 'FollowUp Extendido já estava ativado.'
                : 'Tudo certo, sua funcionalidade premium foi liberada!',
            });
          }
        } catch (err: any) {
          console.error(`[FU Extendido Restore] Erro ao executar pipeline:`, err);
        } finally {
          // Atraso 3s para o usuário curtir animação de sucesso (igual ao fluxo normal)
          setTimeout(() => {
            setIsAcquireDialogOpen(false);
            setSelectedPlanId(null);
            setAcquireStep(1);
            setPagamentoConfirmadoUI(false);
            clearPagamentoFromStorage(settingsOwnerUserId);
            reloadFollowupExtendidoConfig().catch(() => void 0);
          }, 3000);
        }
      })();
      return;
    }

    // ============================================================
    // CASO 2: Pagamento continua PENDING (QR não pago ainda) → retoma no step 3
    // ============================================================
    if (storagePagamento.status === 'PENDING') {
      console.info(
        `[FU Extendido Restore] Storage encontrado: status=PENDING. pagamento_id=${storagePagamento.paymentId}. externalRef=${storagePagamento.externalReference}. Retomando automaticamente no passo 3 (QR Code).`,
      );
      setSelectedPlanId(storagePagamento.planoId);
      setPagamentoAtivo(storagePagamento);
      setAcquireStep(3);
      setIsAcquireDialogOpen(true);
      return;
    }

    // ============================================================
    // Qualquer outro status (CANCELLED, EXPIRED, RECEIVED+pipeline_executado) → limpa
    // ============================================================
    console.warn(
      `[FU Extendido Restore] Storage encontrado mas status=${storagePagamento.status}; pipelineExecutado=${storagePagamento.pipelineExecutado === true}. Limpando storage.`,
    );
    clearPagamentoFromStorage(settingsOwnerUserId);
  }, [settingsOwnerUserId]);

  useEffect(() => {
    const load = async () => {
      if (!settingsOwnerUserId) return;
      setLoadingFollowupExtendidoHistorico(true);
      try {
        const { data, error } = await supabase
          .from('followup_extendido_v2')
          .select('*')
          .eq('user_id', settingsOwnerUserId)
          .eq('followup_extendido', true)
          .order('criado_em', { ascending: false })
          .limit(100);

        console.debug('[FollowUp Extendido] Histórico bruto (followup_extendido_v2):', { data, error });
        if (error) throw error;
        setFollowupExtendidoHistorico(Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('[FollowUp Extendido] Erro ao carregar histórico:', err);
        setFollowupExtendidoHistorico([]);
      } finally {
        setLoadingFollowupExtendidoHistorico(false);
      }
    };
    load();
  }, [settingsOwnerUserId]);

  const followupExtendidoCiclo = useMemo(() => {
    const diaVencimentoRaw =
      userPagamentoConfig?.dia_vencimento?.trim()
        ? userPagamentoConfig.dia_vencimento.trim()
        : (
          user?.dia_vencimento !== undefined && user?.dia_vencimento !== null
            ? String(user.dia_vencimento).trim()
            : ''
        );
    const diaVencimentoNum = diaVencimentoRaw ? Number(diaVencimentoRaw) : NaN;
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth();
    const diaHoje = hoje.getDate();

    const diasMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();

    let inicio: Date | null = null;
    let fim: Date | null = null;
    let diaVencimentoAjustado: number | null = null;

    if (Number.isFinite(diaVencimentoNum) && diaVencimentoNum > 0) {
      const maxDiaAtual = diasMes(anoAtual, mesAtual);
      diaVencimentoAjustado = Math.min(Math.max(1, Math.trunc(diaVencimentoNum)), maxDiaAtual);

      if (diaHoje >= diaVencimentoAjustado) {
        const maxInicio = diasMes(anoAtual, mesAtual);
        const inicioDia = Math.min(diaVencimentoAjustado, maxInicio);
        inicio = new Date(anoAtual, mesAtual, inicioDia, 0, 0, 0, 0);

        const proxMes = mesAtual + 1;
        const anoFim = proxMes > 11 ? anoAtual + 1 : anoAtual;
        const mesFim = proxMes > 11 ? 0 : proxMes;
        const maxFim = diasMes(anoFim, mesFim);
        const fimDia = Math.min(diaVencimentoAjustado, maxFim);
        fim = new Date(anoFim, mesFim, fimDia, 23, 59, 59, 999);
      } else {
        const mesAnterior = mesAtual - 1;
        const anoInicio = mesAnterior < 0 ? anoAtual - 1 : anoAtual;
        const mesInicio = mesAnterior < 0 ? 11 : mesAnterior;
        const maxInicio = diasMes(anoInicio, mesInicio);
        const inicioDia = Math.min(diaVencimentoAjustado, maxInicio);
        inicio = new Date(anoInicio, mesInicio, inicioDia, 0, 0, 0, 0);

        const maxFim = diasMes(anoAtual, mesAtual);
        const fimDia = Math.min(diaVencimentoAjustado, maxFim);
        fim = new Date(anoAtual, mesAtual, fimDia, 23, 59, 59, 999);
      }
    }

    const formatarData = (valor: Date | null) =>
      valor ? valor.toLocaleDateString('pt-BR') : '-';

    const enviadosCiclo = (() => {
      if (!inicio || !fim) return 0;
      const lista = Array.isArray(followupExtendidoHistorico) ? followupExtendidoHistorico : [];
      return lista.reduce((acc: number, row: any) => {
        try {
          const criadoRaw = row?.criado_em;
          if (!criadoRaw) return acc;
          const data = new Date(String(criadoRaw));
          if (Number.isNaN(data.getTime())) return acc;
          return data >= inicio && data <= fim ? acc + 1 : acc;
        } catch {
          return acc;
        }
      }, 0);
    })();

    const volumeNumRaw = String(followupExtendidoVolume || '').trim();
    const volumeNum = volumeNumRaw ? Number(volumeNumRaw) : NaN;
    const volumeValido = Number.isFinite(volumeNum) && volumeNum >= 0 ? volumeNum : 0;
    const pendentesCiclo = Math.max(volumeValido - enviadosCiclo, 0);
    const progressoCiclo =
      volumeValido > 0 ? Math.min(Math.max((enviadosCiclo / volumeValido) * 100, 0), 100) : 0;

    console.debug('[FollowUp Extendido] Ciclo calculado:', {
      dia_vencimento_raw: userPagamentoConfig?.dia_vencimento ?? user?.dia_vencimento,
      diaVencimentoNum,
      diaVencimentoAjustado,
      inicio: inicio?.toISOString(),
      fim: fim?.toISOString(),
      enviadosCiclo,
      volumeValido,
      pendentesCiclo,
      progressoCiclo,
    });

    return {
      diaVencimentoRaw,
      diaVencimentoNum: Number.isFinite(diaVencimentoNum) ? diaVencimentoNum : null,
      inicio,
      fim,
      inicioFormatado: formatarData(inicio),
      fimFormatado: formatarData(fim),
      enviadosCiclo,
      volumeValido,
      pendentesCiclo,
      progressoCiclo,
    };
  }, [userPagamentoConfig?.dia_vencimento, user?.dia_vencimento, followupExtendidoHistorico, followupExtendidoVolume]);

  const handleSaveFollowupExtendidoConfig = async () => {
    if (!settingsOwnerUserId) {
      toast({ title: 'Atenção', description: 'Usuário não identificado.' });
      return;
    }

    const volumeRaw = String(followupExtendidoVolume || '').trim();
    const diasRaw = String(followupExtendidoDiasPerdidos || '').trim();
    const etapasSelecionadas = Array.isArray(followupExtendidoEtapas) ? followupExtendidoEtapas : [];

    const volume = volumeRaw ? Number(volumeRaw) : null;
    const dias = diasRaw ? Number(diasRaw) : null;

    if (volumeRaw && (!Number.isFinite(volume) || volume < 0)) {
      toast({ title: 'Atenção', description: 'Quantidade de followups por ciclo deve ser um número válido.' });
      return;
    }
    // Dias e etapas nunca podem ficar em branco: o cliente configura isso após a contratação
    // e é comum esquecer, então bloqueamos o salvamento em vez de permitir valor vazio.
    if (!diasRaw) {
      toast({ title: 'Atenção', description: 'Informe a frequência de dias (entre 7 e 360).' });
      return;
    }
    if (!Number.isFinite(dias)) {
      toast({ title: 'Atenção', description: 'Quantidade de dias sem resposta deve ser um número válido.' });
      return;
    }
    if (dias! < 7 || dias! > 360) {
      toast({ title: 'Atenção', description: 'A quantidade de dias deve ser entre 7 e 360.' });
      return;
    }
    if (etapasSelecionadas.length === 0) {
      toast({ title: 'Atenção', description: 'Selecione ao menos uma etapa do funil para o FollowUp Extendido.' });
      return;
    }

    setIsSavingFollowupExtendidoConfig(true);
    try {
      const { error } = await supabase
        .from('usuarios_v2')
        .update({
          followup_extendido: Boolean(followupExtendidoAtivo),
          followup_extendido_volume: volume,
          followup_extendido_dias_perdidos: dias,
          followup_extendido_etapas: etapasSelecionadas.join(','),
        } as any)
        .eq('user_id', settingsOwnerUserId);

      if (error) throw error;

      setIsEditingFollowupExtendidoDias(false);
      setIsEditingFollowupExtendidoEtapas(false);

      toast({
        title: 'Configuração salva',
        description: 'As preferências de FollowUp Extendido foram salvas.',
      });
    } catch (err: any) {
      console.error('[FollowUp Extendido] Erro ao salvar configuração:', err);
      toast({ title: 'Erro', description: err?.message || 'Não foi possível salvar as alterações.' });
    } finally {
      setIsSavingFollowupExtendidoConfig(false);
    }
  };

  const handleAcquireClick = () => {
    setSelectedPlanId(null);
    setAcquireStep(1);
    setIsAcquireDialogOpen(true);
  };

  const handleAcquireNext = () => {
    if (acquireStep === 1 && !selectedPlanId) {
      toast({
        title: 'Selecione um plano',
        description: 'Escolha uma das opções para prosseguir.',
        variant: 'destructive',
      });
      return;
    }
    if (acquireStep < 3) {
      if (selectedPlan) {
        console.debug('[FollowUp Extendido] Cálculo de rateio (etapa 2):', {
          plano: selectedPlan.id,
          valor_plano_cheio: selectedPlan.preco,
          dia_vencimento_usuario: user?.dia_vencimento ?? null,
          ...(planoProrrateado ?? {}),
        });
      }
      const nextStep = (acquireStep + 1) as 1 | 2 | 3;

      if (nextStep === 3) {
        if (isAdvancingToStep3 || isCreatingQrCode) {
          console.info('[FU Extendido StepAuto] Já em avanço p/ passo 3 ou criando QR. Ignorando clique duplicado.', {
            isAdvancingToStep3, isCreatingQrCode,
          });
          return;
        }
        if (pagamentoAtivo) {
          console.info('[FU Extendido StepAuto] Pagamento já existe, só navegar (não criar nova cobrança).');
          setAcquireStep(nextStep);
          return;
        }
        setIsAdvancingToStep3(true);
      }

      setAcquireStep(nextStep);

      if (nextStep === 3) {
        queueMicrotask(() => {
          if (!pagamentoAtivo && !isCreatingQrCode) {
            console.info('[FU Extendido StepAuto] Passo 3 carregado. Disparando handleGerarQrCode automaticamente.');
            void handleGerarQrCode().finally(() => {
              setIsAdvancingToStep3(false);
            });
          } else {
            console.info('[FU Extendido StepAuto] Passo 3 carregado mas pagamentoAtivo/criando já existe. Nada a fazer.', {
              temPagamentoAtivo: !!pagamentoAtivo,
              isCreatingQrCode,
            });
            setIsAdvancingToStep3(false);
          }
        });
      }
    }
  };

  const handleAcquireBack = () => {
    if (acquireStep > 1) {
      setIsAdvancingToStep3(false);
      setAcquireStep((s) => (s - 1) as 1 | 2 | 3);
    }
  };

  const handleCloseAcquireDialog = () => {
    setIsAcquireDialogOpen(false);
    setSelectedPlanId(null);
    setAcquireStep(1);
    setIsAdvancingToStep3(false);
  };

  const handleCopiarPixPayload = async () => {
    if (!pagamentoAtivo?.pix?.payload) {
      toast({
        title: 'Atenção',
        description: 'Código PIX não disponível no momento.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(pagamentoAtivo.pix.payload);
      console.debug(
        `[FU Extendido PIX] Copiar payload OK. externalRef=${pagamentoAtivo.externalReference}; tamanho=${pagamentoAtivo.pix.payload.length}`,
      );
      toast({
        title: 'Código copiado!',
        description: 'Cole o código PIX no aplicativo do seu banco para pagar.',
      });
    } catch (err) {
      console.error('[FU Extendido PIX] Erro ao copiar payload PIX:', err);
      toast({
        title: 'Não foi possível copiar',
        description: 'Selecione e copie manualmente o código abaixo.',
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPagamentoPdf = async () => {
    if (!pagamentoAtivo) {
      toast({
        title: 'Atenção',
        description: 'Pagamento não encontrado.',
        variant: 'destructive',
      });
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const correlationId = `PDF_${pagamentoAtivo.externalReference}_${Date.now()}`;
      console.info(
        `[FU Extendido PDF] Iniciando geracao. correlationId=${correlationId}; externalRef=${pagamentoAtivo.externalReference}`,
      );

      const hojeStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const suggestedFileName = `PIX_FollowUp_Extendido_${hojeStr}.pdf`;

      const payload = pagamentoAtivo.pix.payload || '';
      const qrBase64 = pagamentoAtivo.pix.base64 || pagamentoAtivo.pix.qrCodeImageUrl || '';

      const qrImgSrc = qrBase64
        ? qrBase64.startsWith('data:')
          ? qrBase64
          : `data:image/png;base64,${qrBase64}`
        : '';

      const win = window.open('', '_blank', 'width=520,height=780');
      if (!win) {
        toast({
          title: 'Pop-up bloqueado',
          description: 'Habilite pop-ups para baixar o PDF.',
          variant: 'destructive',
        });
        return;
      }

      const payloadQuebrado = payload.length
        ? payload.match(/.{1,40}/g)?.join('\n') || payload
        : '';

      const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Pagamento PIX</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #ffffff; color: #111827;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .page {
    width: 100%; min-height: 100vh; padding: 28px 24px 32px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .titulo {
    font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 18px;
    text-align: center;
  }
  .qr-wrap {
    display: flex; align-items: center; justify-content: center;
    padding: 10px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;
    margin-bottom: 18px;
  }
  .qr-wrap img {
    width: 280px; height: 280px; display: block; image-rendering: pixelated;
  }
  .qr-empty {
    width: 280px; height: 280px; display: flex; align-items: center; justify-content: center;
    color: #6b7280; font-size: 12px; border: 1px dashed #d1d5db; border-radius: 12px;
    background: #fafafa; text-align: center; padding: 20px;
  }
  .label-copia {
    font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 6px;
    align-self: flex-start; width: 100%;
  }
  .payload {
    width: 100%; background: #0b0b0b; color: #f9fafb; border-radius: 10px; padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 11px; line-height: 1.55; word-break: break-all; white-space: pre-wrap;
    user-select: all;
  }
  .acoes {
    width: 100%; display: flex; gap: 10px; justify-content: center;
    margin-top: 20px;
  }
  .btn {
    flex: 1; padding: 10px 14px; border-radius: 10px;
    font-size: 12px; font-weight: 600; cursor: pointer; text-align: center;
  }
  .btn.primary { background: #0b0b0b; color: #ffffff; border: 0; }
  .btn.ghost { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
  .btn.copy { background: #EBF57D; color: #0b0b0b; border: 0; }
  @media print {
    .no-print { display: none !important; }
    .page { padding: 0; }
  }
</style>
</head>
<body>
  <div class="page">
    <div class="titulo">Pagamento via PIX</div>

    ${
      qrImgSrc
        ? `<div class="qr-wrap"><img src="${qrImgSrc}" alt="QR Code PIX" /></div>`
        : `<div class="qr-wrap"><div class="qr-empty">QR Code não disponível.<br/>Use o código copia e cola abaixo.</div></div>`
    }

    <div class="label-copia no-print">Copia e Cola PIX</div>
    <div id="payload-texto" class="payload">${payloadQuebrado || '(PIX não gerado)'}</div>

    <div class="acoes no-print">
      <button type="button" class="btn copy" onclick="(function(){var t=document.getElementById('payload-texto').innerText||'';var l=t.replace(/\\s+/g,'');if(navigator.clipboard&&l){navigator.clipboard.writeText(l);}})();">Copiar código</button>
      <button type="button" class="btn primary" onclick="window.print()">Salvar PDF</button>
      <button type="button" class="btn ghost" onclick="window.close()">Fechar</button>
    </div>
  </div>
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();

      console.info(
        `[FU Extendido PDF] Janela aberta. correlationId=${correlationId}; suggestedFileName="${suggestedFileName}"`,
      );

      toast({
        title: 'PDF preparado',
        description: 'Na janela aberta, clique em "Salvar PDF".',
      });
    } catch (err) {
      console.error('[FU Extendido PDF] Erro ao preparar PDF:', err);
      toast({
        title: 'Erro ao gerar PDF',
        description: 'Tente novamente ou copie o código PIX diretamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleGerarQrCode = async () => {
    if (!selectedPlan || !planoProrrateado) {
      toast({
        title: 'Atenção',
        description: 'Selecione um plano antes de prosseguir.',
        variant: 'destructive',
      });
      return;
    }

    if (!settingsOwnerUserId) {
      toast({
        title: 'Atenção',
        description: 'Usuário não identificado. Atualize a página e tente novamente.',
        variant: 'destructive',
      });
      return;
    }

    let idClienteAsaas = String(userPagamentoConfig?.id_cliente_asaas ?? '').trim();
    let idAssinaturaAsaas = String(userPagamentoConfig?.id_assinatura_asaas ?? '').trim();

    if (!idClienteAsaas || !idAssinaturaAsaas) {
      console.warn(
        `[FU Extendido ASAAS] userPagamentoConfig nao carregado ou vazios. Executando SELECT de refresh antes da guard clause.`,
        {
          settingsOwnerUserId,
          userPagamentoConfig_id_cliente: idClienteAsaas ? 'OK' : 'VAZIO',
          userPagamentoConfig_id_assinatura: idAssinaturaAsaas ? 'OK' : 'VAZIO',
          user_prop_id_cliente: String(user?.id_cliente_asaas ?? '').trim() ? 'OK' : 'VAZIO',
          user_prop_id_assinatura: String(user?.id_assinatura_asaas ?? '').trim() ? 'OK' : 'VAZIO',
        },
      );
      try {
        const { data, error } = await supabase
          .from('usuarios_v2')
          .select(`
            id_cliente_asaas,
            id_assinatura_asaas,
            dia_vencimento,
            user_valor_mensal,
            user_nome,
            user_empresa
          `)
          .eq('user_id', settingsOwnerUserId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const d = data as any;
          idClienteAsaas = String(d.id_cliente_asaas ?? '').trim();
          idAssinaturaAsaas = String(d.id_assinatura_asaas ?? '').trim();
          setUserPagamentoConfig((prev) => ({
            id_cliente_asaas: idClienteAsaas,
            id_assinatura_asaas: idAssinaturaAsaas,
            dia_vencimento: String(d.dia_vencimento ?? prev?.dia_vencimento ?? '').trim(),
            user_valor_mensal: Number(d.user_valor_mensal) || prev?.user_valor_mensal || 0,
            user_nome: d.user_nome ?? prev?.user_nome,
            user_empresa: d.user_empresa ?? prev?.user_empresa,
          }));
          console.info('[FU Extendido ASAAS] userPagamentoConfig atualizado por refresh no handleGerarQrCode.');
        }
      } catch (e: any) {
        console.error('[FU Extendido ASAAS] Erro no SELECT refresh antes de guard clause:', e?.message || e);
      }
    }

    if (!idClienteAsaas) {
      console.error(
        `[FU Extendido ASAAS] Guard clause: id_cliente_asaas ausente. user_id=${settingsOwnerUserId}`,
      );
      toast({
        title: 'Não foi possível gerar o pagamento',
        description:
          'Seu cadastro não possui ID de cliente vinculado à plataforma de pagamento. Entre em contato com o suporte.',
        variant: 'destructive',
      });
      return;
    }

    if (!idAssinaturaAsaas) {
      console.error(
        `[FU Extendido ASAAS] Guard clause: id_assinatura_asaas ausente. user_id=${settingsOwnerUserId}`,
      );
      toast({
        title: 'Não foi possível gerar o pagamento',
        description:
          'Sua assinatura não foi encontrada na plataforma de pagamento. Entre em contato com o suporte.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingQrCode(true);
    const correlationId = `FU_EXTENDIDO_${settingsOwnerUserId}_${Date.now()}`;
    const timestampUnix = Math.floor(Date.now() / 1000);
    const externalReference = `FU_EXTENDIDO_${settingsOwnerUserId}_${timestampUnix}`;

    const valorRateioCentavos = Math.round(Number(planoProrrateado.valorRateio) * 100);
    const valorPlanoCheioCentavos = Math.round(Number(planoProrrateado.valorPlanoCheio) * 100);
    const valorProxFaturaCentavos = Math.round(Number(planoProrrateado.valorProxFatura) * 100);

    console.groupCollapsed(`[FU Extendido ASAAS] ${correlationId} — Criar cobrança PIX`);
    console.info('correlationId:', correlationId);
    console.info('externalReference:', externalReference);
    console.info('user_id (settingsOwnerUserId):', settingsOwnerUserId);
    console.info('id_cliente_asaas:', idClienteAsaas);
    console.info('id_assinatura_asaas:', idAssinaturaAsaas);
    console.info('plano selecionado:', { id: selectedPlan.id, nome: selectedPlan.nome });
    console.info('valores calculados (rateio):', {
      valorRateio: planoProrrateado.valorRateio,
      valorRateioCentavos,
      valorPlanoCheio: planoProrrateado.valorPlanoCheio,
      valorPlanoCheioCentavos,
      valorProxFatura: planoProrrateado.valorProxFatura,
      valorProxFaturaCentavos,
    });
    console.info('dados do ciclo:', {
      inicio: planoProrrateado.inicioCiclo,
      fim: planoProrrateado.fimCiclo,
      diaVencimento: planoProrrateado.diaVencimento,
      totalDiasCiclo: planoProrrateado.totalDiasCiclo,
      diasRestantes: planoProrrateado.diasRestantes,
    });
    console.info('payload montado para Edge Function (POST /v3/payments Asaas):', {
      customer: idClienteAsaas,
      billingType: 'PIX',
      value: planoProrrateado.valorRateio,
      dueDate: new Date().toISOString().split('T')[0],
      externalReference,
      description: `FollowUp Extendido - Plano ${selectedPlan.nome} - Ciclo ${planoProrrateado.inicioCiclo} a ${planoProrrateado.fimCiclo} (ativação imediata)`,
    });
    console.info('idempotency-key:', correlationId);
    console.groupEnd();

    try {
      const apiKey = getAsaasApiKey();
      if (shouldRequireAsaasApiKey() && !apiKey) {
        throw new Error('Chave de API do Asaas não configurada.');
      }

      // Asaas Idempotency-Key LIMITA em no MAX 48 caracteres.
      // Colocamos TIMESTAMP SEGUIDO de externalReference (não o contrário).
      // Assim mesmo truncando, os 48 chars mais à esquerda contêm TS único → evita
      // conflito de idempotência ao reativar funcionalidade (ex: followup_extendido=false e tenta de novo).
      const idempotencyKeySafe =
        String(`${Date.now()}_${externalReference}`).slice(0, 48);

      const headersAsaas: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headersAsaas['access_token'] = apiKey;
      }
      headersAsaas['idempotency'] = idempotencyKeySafe;
      headersAsaas['idempotency-key'] = idempotencyKeySafe;
      console.info(
        `[FU Extendido ASAAS] ${correlationId} — Idempotency-Key (48 chars max) = "${idempotencyKeySafe}" (tamanho=${idempotencyKeySafe.length}).`,
      );

      const bodyPagamento = {
        customer: idClienteAsaas,
        billingType: 'PIX',
        value: Number(planoProrrateado.valorRateio.toFixed(2)),
        dueDate: new Date().toISOString().split('T')[0],
        externalReference,
        description: 'FollowUp Extendido (Ativação)',
        postalService: false,
      };

      console.info(
        `[FU Extendido ASAAS] ${correlationId} — Criando pagamento via asaasFetch. endpoint=POST /payments; value=${bodyPagamento.value}; customer=${bodyPagamento.customer.slice(0,6)}...${bodyPagamento.customer.slice(-4)}`,
      );

      const respCriar = await asaasFetch('/payments', {
        method: 'POST',
        headers: headersAsaas,
        body: JSON.stringify(bodyPagamento),
      });

      let pagamentoAsaas: any = null;
      let statusCriar = respCriar.status;

      if (!respCriar.ok && respCriar.status === 409) {
        // ==== CASO 409 CONFLICT — idempotency-key usado anteriormente (ou externalReference já existe) ====
        // Significa que a cobrança JÁ FOI CRIADA (ex: usuário reativou funcionalidade).
        // NÃO criamos cobrança duplicada — BUSCAMOS a cobrança já existente por externalReference
        // e continuamos o fluxo normal (QR code, polling etc.).
        console.warn(
          `[FU Extendido ASAAS] ${correlationId} — POST /payments retornou 409 CONFLICT (idempotency/externalRef ja utilizado). Buscando cobrança existente por externalReference=${externalReference} ...`,
        );

        try {
          const buscaResp = await asaasFetch(
            `/payments?customer=${encodeURIComponent(idClienteAsaas)}&externalReference=${encodeURIComponent(externalReference)}&limit=1`,
            {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                ...(apiKey ? { access_token: apiKey } : {}),
              },
            },
          );
          if (buscaResp.ok) {
            const lista: any = await buscaResp.json();
            const primeira = Array.isArray(lista?.data) ? lista.data[0] : null;
            if (primeira?.id) {
              pagamentoAsaas = primeira;
              statusCriar = 200;
              console.info(
                `[FU Extendido ASAAS] ${correlationId} — 409 resolvido: encontrada cobrança existente ${primeira.id}. status=${primeira.status}.`,
              );
            }
          }
        } catch (buscaErr) {
          console.warn(
            `[FU Extendido ASAAS] ${correlationId} — 409 mas falhou ao buscar externalReference.`,
            buscaErr,
          );
        }
      }

      if (statusCriar !== 200 && statusCriar !== 201 && !pagamentoAsaas) {
        const t = await respCriar.text().catch(() => '');
        let msg = t;
        try {
          const j = JSON.parse(t);
          if (j?.errors?.[0]?.description) msg = j.errors[0].description;
          else if (j?.error) msg = j.error;
        } catch {}
        console.error(
          `[FU Extendido ASAAS] ${correlationId} — POST /payments falhou:`,
          { status: statusCriar, preview: t.slice(0, 400) },
        );
        throw new Error(msg || `Asaas retornou status ${statusCriar}`);
      }

      // Se não tivermos pagamentoAsaas ainda (caso 200/201 normal), parse o body da response:
      if (!pagamentoAsaas) {
        try {
          pagamentoAsaas = await respCriar.json();
        } catch (_ignorado) {
          pagamentoAsaas = null;
        }
      }

      const asaasPaymentId = String(pagamentoAsaas?.id || '').trim();
      const asaasStatus = String(pagamentoAsaas?.status || 'PENDING')
        .trim()
        .toUpperCase();

      if (!asaasPaymentId) {
        console.error(
          `[FU Extendido ASAAS] ${correlationId} — Pagamento criado sem ID?`,
          pagamentoAsaas,
        );
        throw new Error('A plataforma de pagamento não retornou o ID da cobrança.');
      }

      console.info(
        `[FU Extendido ASAAS] ${correlationId} — Pagamento criado. payment_id=${asaasPaymentId}; status_asaas=${asaasStatus}. Buscando pixQrCode...`,
      );

      let pixPayload = '';
      let pixBase64: string | null = null;
      let pixQrUrl: string | null = null;
      let pixExpiration: string | null = null;

      try {
        const qrResp = await asaasFetch(
          `/payments/${encodeURIComponent(asaasPaymentId)}/pixQrCode`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
              ...(apiKey ? { access_token: apiKey } : {}),
            },
          },
        );
        if (qrResp.ok) {
          const d = await qrResp.json();
          pixPayload = String(d?.payload || d?.qrCodePayload || pagamentoAsaas?.pix?.qrCode?.payload || '').trim();
          pixBase64 = (String(d?.encodedImage || d?.qrCode?.encodedImage || '').trim() || null) as string | null;
          pixQrUrl = (String(d?.qrCodeImageUrl || d?.qrCode?.url || '').trim() || null) as string | null;
          pixExpiration = d?.expirationDate || d?.qrCode?.expirationDate || pagamentoAsaas?.pix?.qrCode?.expirationDate || pagamentoAsaas?.dueDate || null;
          pixExpiration = pixExpiration ? new Date(String(pixExpiration)).toISOString() : null;
        } else {
          console.warn(
            `[FU Extendido ASAAS] ${correlationId} — GET pixQrCode status=${qrResp.status}; tentando extrair direto do body do pagamento...`,
          );
          pixPayload = String(pagamentoAsaas?.pix?.payload || pagamentoAsaas?.pix?.qrCode?.payload || '').trim();
          pixBase64 = String(pagamentoAsaas?.pix?.qrCode?.encodedImage || pagamentoAsaas?.pix?.qrCode?.base64 || '').trim() || null;
          pixQrUrl = String(pagamentoAsaas?.pix?.qrCode?.url || pagamentoAsaas?.pix?.qrCodeImageUrl || '').trim() || null;
          pixExpiration = pagamentoAsaas?.pix?.qrCode?.expirationDate || pagamentoAsaas?.dueDate || null;
          pixExpiration = pixExpiration ? new Date(String(pixExpiration)).toISOString() : null;
        }
      } catch (e: any) {
        console.warn(
          `[FU Extendido ASAAS] ${correlationId} — Erro ao buscar pixQrCode (NÃO FATAL se payload estiver em pagamentoAsaas):`,
          e?.message || e,
        );
        pixPayload = String(pagamentoAsaas?.pix?.payload || pagamentoAsaas?.pix?.qrCode?.payload || '').trim();
        pixBase64 = String(pagamentoAsaas?.pix?.qrCode?.encodedImage || pagamentoAsaas?.pix?.qrCode?.base64 || '').trim() || null;
        pixExpiration = pagamentoAsaas?.dueDate ? new Date(String(pagamentoAsaas.dueDate)).toISOString() : null;
      }

      if (!pixPayload) {
        throw new Error(
          'A cobrança foi criada, mas o código PIX não foi retornado. Tente novamente em alguns segundos.',
        );
      }

      const statusNormalizado: FollowUpExtendidoPagamentoStatus = (() => {
        if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED') return 'RECEIVED';
        if (asaasStatus === 'OVERDUE' || asaasStatus === 'EXPIRED') return 'EXPIRED';
        if (asaasStatus === 'DELETED' || asaasStatus === 'CANCELLED') return 'CANCELLED';
        return 'PENDING';
      })();

      const pagamento: FollowUpExtendidoPagamento = {
        paymentId: asaasPaymentId,
        externalReference,
        status: statusNormalizado,
        planoId: selectedPlan.id,
        valorRateio: planoProrrateado.valorRateio,
        valorPlanoCheio: planoProrrateado.valorPlanoCheio,
        valorProxFatura: planoProrrateado.valorProxFatura,
        ciclo: {
          inicio: planoProrrateado.inicioCiclo,
          fim: planoProrrateado.fimCiclo,
          diaVencimento: planoProrrateado.diaVencimento,
          diasRestantes: planoProrrateado.diasRestantes,
        },
        pix: {
          payload: pixPayload,
          base64: pixBase64,
          qrCodeImageUrl: pixQrUrl,
          expirationDate: pixExpiration,
        },
        createdAt: Date.now(),
        lastPolledAt: null,
        completedAt: null,
        dadosCliente: {
          nome: String(user?.nome || user?.nome_empresa || '').trim() || undefined,
          empresa: String(user?.nome_empresa || '').trim() || undefined,
        },
      };

      savePagamentoToStorage(settingsOwnerUserId, pagamento);
      setPagamentoAtivo(pagamento);

      console.info(
        `[FU Extendido ASAAS] ${correlationId} — Cobrança REAL criada com sucesso. payment_id=${pagamento.paymentId}; externalRef=${pagamento.externalReference}; status=${pagamento.status}. Salvo no localStorage.`,
      );

      toast({
        title: 'QR Code gerado!',
        description:
          'Realize o pagamento via PIX. Quando confirmado, a funcionalidade será ativada automaticamente.',
      });
    } catch (err: any) {
      console.error(`[FU Extendido ASAAS] ${correlationId} — Erro ao criar cobrança:`, err);
      toast({
        title: 'Não foi possível gerar o pagamento',
        description:
          err?.message || 'Tente novamente em alguns segundos ou contate o suporte.',
        variant: 'destructive',
      });
      setPagamentoAtivo(null);
    } finally {
      setIsCreatingQrCode(false);
    }
  };

  const reloadFollowupExtendidoConfig = async () => {
    if (!settingsOwnerUserId) return;
    console.debug('[FU Extendido Refresh] Revalidando configuração do usuário (polling / pós-confirmação)...');
    setLoadingFollowupExtendidoConfig(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_v2')
        .select('followup_extendido, followup_extendido_volume, followup_extendido_dias_perdidos')
        .eq('user_id', settingsOwnerUserId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const ativo = Boolean((data as any)?.followup_extendido ?? false);
        const volume =
          (data as any)?.followup_extendido_volume === null || (data as any)?.followup_extendido_volume === undefined
            ? ''
            : String((data as any).followup_extendido_volume);
        const dias =
          (data as any)?.followup_extendido_dias_perdidos === null || (data as any)?.followup_extendido_dias_perdidos === undefined
            ? ''
            : String((data as any).followup_extendido_dias_perdidos);
        setFollowupExtendidoAtivo(ativo);
        setFollowupExtendidoVolume(volume);
        setFollowupExtendidoDiasPerdidos(dias);
        console.info('[FU Extendido Refresh] Configuração recarregada:', {
          followup_extendido: ativo,
          volume,
          dias_perdidos: dias,
        });
      }
    } catch (err: any) {
      console.error('[FU Extendido Refresh] Erro ao revalidar configuração:', err);
    } finally {
      setLoadingFollowupExtendidoConfig(false);
    }
  };

  const PLANOS_PRECOS_FU: Record<string, number> = {
    essencial: 99,
    pro: 190,
    empresarial: 490,
  };
  const PLANOS_VOLUME_FU: Record<string, number> = {
    essencial: 40,
    pro: 100,
    empresarial: 300,
  };

  const executarPipelinePosPagamento = async (
    pagamentoConfirmado: FollowUpExtendidoPagamento,
  ): Promise<{ ok: boolean; guard_clause?: boolean; detalhes?: any; erro?: string }> => {
    const correlationId = `PIPELINE_${pagamentoConfirmado.externalReference}_${Date.now()}`;

    console.groupCollapsed(`[FU Pipeline ${correlationId}] Iniciando pipeline pós-pagamento RECEIVED`);
    console.info('externalReference:', pagamentoConfirmado.externalReference);
    console.info('planoId:', pagamentoConfirmado.planoId);
    console.info('paymentId:', pagamentoConfirmado.paymentId);
    console.groupEnd();

    try {
      if (!settingsOwnerUserId) throw new Error('settingsOwnerUserId ausente');

      const precoPlanoReais = PLANOS_PRECOS_FU[String(pagamentoConfirmado.planoId || '').toLowerCase()] || 0;
      const volumePadrao = PLANOS_VOLUME_FU[String(pagamentoConfirmado.planoId || '').toLowerCase()] || 40;

      if (precoPlanoReais <= 0) throw new Error(`planoId desconhecido: ${pagamentoConfirmado.planoId}`);

      // ---- Step 1: SELECT usuarios_v2 ----
      console.info(`[FU Pipeline ${correlationId}] Step 1/5: SELECT usuarios_v2 WHERE user_id=eq.${settingsOwnerUserId} ...`);
      const { data: userRow, error: errSel } = await supabase
        .from('usuarios_v2')
        .select(
          'user_id,followup_extendido,followup_extendido_volume,user_valor_mensal,id_assinatura_asaas,id_cliente_asaas,dia_vencimento',
        )
        .eq('user_id', settingsOwnerUserId)
        .maybeSingle();

      if (errSel) throw new Error(`select_usuarios: ${errSel.message}`);
      if (!userRow) throw new Error('usuario_nao_encontrado');
      const ur = userRow as any;

      const followup_extendido_atual = Boolean(ur.followup_extendido ?? false);
      const idAssinaturaAsaas = String(ur.id_assinatura_asaas || '').trim();
      const userValorMensalAtualReais = Number(ur.user_valor_mensal) || 0;

      // ---- Step 2: GUARD CLAUSE ANTI DUPLA ATIVAÇÃO ----
      if (followup_extendido_atual === true) {
        console.warn(
          `[FU Pipeline ${correlationId}] Step 2/5: GUARD CLAUSE — followup_extendido já é true. Abortando pipeline SEM ALTERAR NADA para não somar 2x no user_valor_mensal.`,
        );
        console.groupCollapsed(`[FU Pipeline ${correlationId}] ✅ Concluído (guard clause).`);
        console.info('guard_clause=already_active');
        console.groupEnd();
        return { ok: true, guard_clause: true, detalhes: { motivo: 'already_active' } };
      }

      // ---- Step 3: UPDATE usuarios_v2 ----
      console.info(`[FU Pipeline ${correlationId}] Step 3/5: PATCH usuarios_v2.`);
      console.info('  - user_valor_mensal (de):', userValorMensalAtualReais);
      console.info('  - followup_extendido_volume (padrão plano):', volumePadrao);
      const novoValorMensalReais = userValorMensalAtualReais + precoPlanoReais;
      console.info('  - user_valor_mensal (para):', novoValorMensalReais);

      const volumeAtualBanco =
        ur.followup_extendido_volume === null || ur.followup_extendido_volume === undefined
          ? null
          : Number(ur.followup_extendido_volume);
      const novoVolume =
        volumeAtualBanco && volumeAtualBanco > 0 ? volumeAtualBanco : volumePadrao;

      const { error: errUpd } = await supabase
        .from('usuarios_v2')
        .update({
          user_valor_mensal: novoValorMensalReais,
          followup_extendido: true,
          followup_extendido_volume: novoVolume,
        } as any)
        .eq('user_id', settingsOwnerUserId);

      if (errUpd) {
        console.error(
          `[FU Pipeline ${correlationId}] Step 3/5 FALHOU. Pipeline ABORTADO (não tocaremos Asaas para evitar divergência).`,
          errUpd,
        );
        throw new Error(`update_usuarios: ${errUpd.message}`);
      }
      console.info(`[FU Pipeline ${correlationId}] Step 3/5 OK. usuarios_v2 atualizado.`);

      // Verifica se tem id_assinatura_asaas — se não, pular etapas 4 e 5 com warn (não fatal)
      let cancelamentosFuturos = { ok: 0, falha: 0, ids: [] as string[] };
      let patchAssinaturaOk = false;
      let patchAssinaturaErro: string | null = null;

      if (!idAssinaturaAsaas) {
        console.warn(
          `[FU Pipeline ${correlationId}] Steps 4/5 e 5/5 SKIPPADOS: id_assinatura_asaas ausente em usuarios_v2. Nada para apagar/atualizar no Asaas.`,
        );
      } else {
        const apiKey = getAsaasApiKey();
        if (shouldRequireAsaasApiKey() && !apiKey) {
          console.warn(
            `[FU Pipeline ${correlationId}] Steps 4/5 e 5/5 SKIPPADOS (não fatal): shouldRequireAsaasApiKey=true mas chave frontend ausente. Tente novamente depois ou configure o token no servidor.`,
          );
        } else {
          const headersAsaas = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(apiKey ? { access_token: apiKey } : {}),
          };

          // ---- Step 4: Listar + deletar cobranças futuras pendentes da assinatura ----
          console.info(
            `[FU Pipeline ${correlationId}] Step 4/5: Listando cobranças PENDENTES FUTURAS da assinatura ${idAssinaturaAsaas.slice(0,4)}...${idAssinaturaAsaas.slice(-3)} ...`,
          );
          try {
            const hojeIso = new Date().toISOString().split('T')[0];
            const respLista = await asaasFetch(
              `/subscriptions/${encodeURIComponent(idAssinaturaAsaas)}/payments?limit=100&status=PENDING`,
              { method: 'GET', headers: { Accept: 'application/json', ...(apiKey ? { access_token: apiKey } : {}) } },
            );
            let pagamentosPendentes: any[] = [];
            if (respLista.ok) {
              const lista: any = await respLista.json();
              pagamentosPendentes = Array.isArray(lista?.data) ? lista.data : [];
            }
            console.info(
              `[FU Pipeline ${correlationId}] Step 4/5: Encontradas ${pagamentosPendentes.length} cobranças PENDING da assinatura. Filtrando datas futuras >= HOJE (${hojeIso}).`,
            );

            const idsDeletar: string[] = [];
            for (const p of pagamentosPendentes) {
              const data = String(p?.dueDate || p?.expectedPaymentDate || '').split('T')[0].trim();
              if (!data) continue;
              if (data >= hojeIso) {
                idsDeletar.push(String(p?.id || '').trim());
              }
            }
            console.info(
              `[FU Pipeline ${correlationId}] Step 4/5: ${idsDeletar.length} cobranças FUTURAS (>= hoje) serão deletadas. ids=`,
              idsDeletar,
            );

            for (const pid of idsDeletar) {
              if (!pid) continue;
              try {
                const delResp = await asaasFetch(`/payments/${encodeURIComponent(pid)}`, {
                  method: 'DELETE',
                  headers: { Accept: 'application/json', ...(apiKey ? { access_token: apiKey } : {}) },
                });
                if (delResp.ok) {
                  cancelamentosFuturos.ok += 1;
                  cancelamentosFuturos.ids.push(pid);
                } else {
                  cancelamentosFuturos.falha += 1;
                  console.warn(
                    `[FU Pipeline ${correlationId}] Step 4/5: DELETE payment ${pid} status=${delResp.status} (WARN, NÃO FATAL).`,
                  );
                }
              } catch (e) {
                cancelamentosFuturos.falha += 1;
                console.warn(
                  `[FU Pipeline ${correlationId}] Step 4/5: Exceção DELETE payment ${pid}:`,
                  e,
                );
              }
            }
          } catch (e: any) {
            console.warn(
              `[FU Pipeline ${correlationId}] Step 4/5: Exceção geral ao listar/deletar (NÃO FATAL, banco já atualizado):`,
              e?.message || e,
            );
          }

          // ---- Step 5: PUT /subscriptions/{id} com novo valor total ----
          // PADRÃO EXATO DA ABA ASSINATURA (ver Assinatura.tsx handleChangeDueDate 772-788):
          // OBRIGATÓRIO enviar nextDueDate + updatePendingPayments=true
          // Só método PUT funciona (Asaas não aceita PATCH para alterar valor/nextDueDate).
          console.info(
            `[FU Pipeline ${correlationId}] Step 5/5: PUT assinatura ${idAssinaturaAsaas.slice(0,4)}...${idAssinaturaAsaas.slice(-3)} COM PADRÃO ABA ASSINATURA (nextDueDate + updatePendingPayments=true). value=${novoValorMensalReais}.`,
          );

          try {
            // Calcula nextDueDate igual ao padrão Assinatura: se HOJE >= dia_vencimento
            // então próxima data é mês que vem no mesmo dia. Caso contrário é esse mês no dia_vencimento.
            const agora = new Date();
            const diaVencimentoRaw = String(ur.dia_vencimento || '').trim();
            const diaVencimentoNum = parseInt(diaVencimentoRaw, 10);
            const diaSeguro =
              isNaN(diaVencimentoNum) || diaVencimentoNum < 1 || diaVencimentoNum > 31
                ? 15
                : diaVencimentoNum;
            const ultimoDiaProximoMes = new Date(
              agora.getFullYear(),
              agora.getMonth() + 2,
              0,
            ).getDate();
            const diaLimite = Math.min(diaSeguro, ultimoDiaProximoMes);
            const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
            const dataAtualMes = new Date(agora.getFullYear(), agora.getMonth(), diaLimite);
            const dataProximoMes = new Date(agora.getFullYear(), agora.getMonth() + 1, diaLimite);
            const ultimoDiaMesAtual = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).getDate();
            let dataAtualMesSegura = new Date(agora.getFullYear(), agora.getMonth(), Math.min(diaLimite, ultimoDiaMesAtual));
            const nextDueDateDate =
              dataAtualMesSegura <= hoje ? dataProximoMes : dataAtualMesSegura;
            const nextDueDateYmd =
              nextDueDateDate.getFullYear() +
              '-' +
              String(nextDueDateDate.getMonth() + 1).padStart(2, '0') +
              '-' +
              String(nextDueDateDate.getDate()).padStart(2, '0');

            const putBody = {
              value: Number(novoValorMensalReais.toFixed(2)),
              nextDueDate: nextDueDateYmd,
              updatePendingPayments: true,
            };

            console.info(
              `[FU Pipeline ${correlationId}] Step 5/5: PUT body =`,
              putBody,
            );

            const finalResp = await asaasFetch(
              `/subscriptions/${encodeURIComponent(idAssinaturaAsaas)}`,
              {
                method: 'PUT',
                headers: {
                  accept: 'application/json',
                  'content-type': 'application/json',
                  ...(apiKey ? { access_token: apiKey } : {}),
                },
                body: JSON.stringify(putBody),
              },
            );

            if (finalResp.ok) {
              patchAssinaturaOk = true;
              let respValorConfirmado: any = null;
              try {
                respValorConfirmado = await finalResp.json();
              } catch {}
              console.info(
                `[FU Pipeline ${correlationId}] Step 5/5 OK. Assinatura atualizada no Asaas. response.value=${respValorConfirmado?.value}; response.nextDueDate=${respValorConfirmado?.nextDueDate}; response.updatePendingPayments=${respValorConfirmado?.updatePendingPayments}.`,
              );
            } else {
              const t = await finalResp.text().catch(() => '');
              let detalheErro = '';
              try {
                const jsonErr = JSON.parse(t);
                if (jsonErr?.errors?.[0]?.description) detalheErro = jsonErr.errors[0].description;
                else if (jsonErr?.error) detalheErro = jsonErr.error;
                else if (jsonErr?.message) detalheErro = jsonErr.message;
              } catch {}
              patchAssinaturaErro = detalheErro
                ? `${detalheErro} (status_${finalResp.status})`
                : `status_${finalResp.status}: ${t.slice(0, 180)}`;
              console.warn(
                `[FU Pipeline ${correlationId}] Step 5/5 WARN (NÃO FATAL, banco já está certo): status=${finalResp.status}. body preview=`,
                t.slice(0, 400),
              );
            }
          } catch (e: any) {
            patchAssinaturaErro = e?.message || String(e);
            console.warn(
              `[FU Pipeline ${correlationId}] Step 5/5 Exceção (NÃO FATAL):`,
              e?.message || e,
            );
          }
        }
      }

      console.groupCollapsed(`[FU Pipeline ${correlationId}] ✅ Pipeline concluído SEM ERROS FATAIS.`);
      console.info('guard_clause=executado (primeira ativação)');
      console.info('user_valor_mensal_de:', userValorMensalAtualReais);
      console.info('user_valor_mensal_para:', novoValorMensalReais);
      console.info('followup_extendido=true');
      console.info('followup_extendido_volume:', novoVolume);
      console.info('cancelamentos_futuros:', cancelamentosFuturos);
      console.info('patch_assinatura_ok:', patchAssinaturaOk);
      if (patchAssinaturaErro) console.info('patch_assinatura_erro:', patchAssinaturaErro);
      console.groupEnd();

      return {
        ok: true,
        detalhes: {
          user_valor_mensal_de: userValorMensalAtualReais,
          user_valor_mensal_para: novoValorMensalReais,
          followup_extendido: true,
          followup_extendido_volume: novoVolume,
          cancelamentos_futuros: cancelamentosFuturos,
          patch_assinatura_ok: patchAssinaturaOk,
          patch_assinatura_erro: patchAssinaturaErro || null,
          plano: pagamentoConfirmado.planoId,
          preco_plano_reais: precoPlanoReais,
        },
      };
    } catch (e: any) {
      const msg = e?.message || String(e);
      console.error(`[FU Pipeline ${correlationId}] ❌ ERRO FATAL no pipeline:`, msg, e);
      return { ok: false, erro: msg };
    }
  };

  const pollStatusPagamentoOnce = async (
    pagamento: FollowUpExtendidoPagamento,
  ): Promise<{ novoStatus: FollowUpExtendidoPagamentoStatus; rawResponse?: any }> => {
    const correlationId = `POLL_${pagamento.externalReference}_${Date.now()}`;
    console.debug(
      `[FU Extendido Polling] ${correlationId} — Consultando status pagamento_id=${pagamento.paymentId} via asaasFetch /payments`,
    );

    try {
      const apiKey = getAsaasApiKey();
      if (shouldRequireAsaasApiKey() && !apiKey) {
        console.warn(
          `[FU Extendido Polling] ${correlationId} — shouldRequireAsaasApiKey=true mas sem chave frontend. Tentando mesmo assim (proxy injeta no servidor)...`,
        );
      }
      const headers = {
        Accept: 'application/json',
        ...(apiKey ? { access_token: apiKey } : {}),
      };

      let statusAsaasRaw = '';
      let rawData: any = null;

      try {
        const byIdResp = await asaasFetch(
          `/payments/${encodeURIComponent(pagamento.paymentId)}`,
          {
            method: 'GET',
            headers,
          },
        );
        if (byIdResp.ok) {
          rawData = await byIdResp.json();
          statusAsaasRaw = String(rawData?.status || '').trim().toUpperCase();
        }
      } catch (e) {
        console.warn(
          `[FU Extendido Polling] ${correlationId} — Erro ao consultar por ID, tentando externalReference...`,
          e,
        );
      }

      if (!statusAsaasRaw && pagamento.externalReference) {
        try {
          const byRefResp = await asaasFetch(
            `/payments?externalReference=${encodeURIComponent(pagamento.externalReference)}&limit=1`,
            { method: 'GET', headers },
          );
          if (byRefResp.ok) {
            const refData: any = await byRefResp.json();
            const first = Array.isArray(refData?.data) ? refData.data[0] : null;
            if (first?.status) {
              rawData = first;
              statusAsaasRaw = String(first.status).trim().toUpperCase();
            }
          }
        } catch (e) {
          console.warn(
            `[FU Extendido Polling] ${correlationId} — Erro ao consultar por externalReference:`,
            e,
          );
        }
      }

      const statusNormalizado: FollowUpExtendidoPagamentoStatus = (() => {
        if (statusAsaasRaw === 'RECEIVED' || statusAsaasRaw === 'CONFIRMED') return 'RECEIVED';
        if (statusAsaasRaw === 'OVERDUE' || statusAsaasRaw === 'EXPIRED') return 'EXPIRED';
        if (statusAsaasRaw === 'DELETED' || statusAsaasRaw === 'CANCELLED' || statusAsaasRaw === 'REFUNDED') return 'CANCELLED';
        if (
          statusAsaasRaw === 'PENDING' ||
          statusAsaasRaw === 'AWAITING_RISK_ANALYSIS' ||
          statusAsaasRaw === 'PROCESSING' ||
          statusAsaasRaw === 'INITIATED' ||
          statusAsaasRaw === 'AWAITING_PAYMENT'
        ) {
          return 'PENDING';
        }
        if (!statusAsaasRaw) return pagamento.status ?? 'PENDING';
        return pagamento.status ?? 'PENDING';
      })();

      return { novoStatus: statusNormalizado, rawResponse: rawData };
    } catch (err: any) {
      console.warn(
        `[FU Extendido Polling] ${correlationId} — Exceçao no polling, mantendo status atual:`,
        err,
      );
      return {
        novoStatus: pagamentoAtivo?.status ?? pagamento.status ?? 'PENDING',
        rawResponse: { exception: err?.message || String(err) },
      };
    }
  };

  // ===== ETAPA 3: Polling a cada 3s enquanto dialog está no passo 3 e pagamento PENDING =====
  useEffect(() => {
    if (!isAcquireDialogOpen) return;
    if (acquireStep !== 3) return;
    if (!pagamentoAtivo) return;
    if (pagamentoAtivo.status !== 'PENDING') return;
    if (pagamentoConfirmadoUI) return;

    console.info(
      `[FU Extendido Polling] Iniciando ciclo de polling para pagamento_id=${pagamentoAtivo.paymentId} externalRef=${pagamentoAtivo.externalReference}. Intervalo=3s.`,
    );

    setIsPollingPagamento(true);
    let cancelled = false;
    let tentativas = 0;
    let timeoutAuto: NodeJS.Timeout | null = null;

    const tick = async () => {
      if (cancelled) return;
      if (!settingsOwnerUserId) return;
      const snapAtivo = pagamentoAtivo;
      if (!snapAtivo || snapAtivo.status !== 'PENDING') return;

      tentativas += 1;
      try {
        const { novoStatus, rawResponse } = await pollStatusPagamentoOnce(snapAtivo);
        if (cancelled) return;

        const atualizado: FollowUpExtendidoPagamento = {
          ...snapAtivo,
          status: novoStatus,
          lastPolledAt: Date.now(),
        };

        if (novoStatus !== snapAtivo.status) {
          console.info(
            `[FU Extendido Polling] Status alterado: ${snapAtivo.status} → ${novoStatus}. pagamento_id=${snapAtivo.paymentId}`,
          );
        } else {
          console.debug(
            `[FU Extendido Polling] Tentativa ${tentativas} — status continua ${novoStatus}.`,
          );
        }

        if (settingsOwnerUserId) {
          savePagamentoToStorage(settingsOwnerUserId, atualizado);
        }
        setPagamentoAtivo(atualizado);

        if (novoStatus === 'RECEIVED') {
          console.groupCollapsed(
            `🎉 [FU Extendido Polling] Pagamento CONFIRMADO (via polling UI). externalRef=${atualizado.externalReference}`,
          );
          console.info('pagamento_id:', atualizado.paymentId);
          console.info('valorRateio (R$):', atualizado.valorRateio);
          console.info('valorProxFatura (R$):', atualizado.valorProxFatura);
          console.info('planoId:', atualizado.planoId);
          console.info('ciclo:', atualizado.ciclo);
          console.info(
            '>>> Executando pipeline de ativação no FRONTEND (padrão ABA ASSINATURA): SELECT → GUARD → UPDATE usuarios_v2 → DELETE cobranças futuras → PATCH assinatura Asaas.',
          );
          console.groupEnd();

          // ===== EXECUTA PIPELINE PÓS-PAGAMENTO (igual padrão ABA ASSINATURA) =====
          const pipelineRes = await executarPipelinePosPagamento(atualizado);
          if (pipelineRes.ok === false) {
            toast({
              title: 'Pagamento recebido!',
              description:
                'A confirmação do PIX chegou, mas houve um erro ao finalizar a ativação. Por favor contate o suporte informando o código: ' +
                atualizado.externalReference,
              variant: 'destructive',
            });
          } else if (pipelineRes.guard_clause) {
            console.info(
              `[FU Extendido Polling] Pipeline retornou guard_clause (funcionalidade já ativada anteriormente). Continuando normalmente.`,
            );
          }

          if (settingsOwnerUserId) {
            const finalizado: FollowUpExtendidoPagamento = {
              ...atualizado,
              completedAt: Date.now(),
              pipelineExecutado: pipelineRes.ok === true,
              pipelineErro:
                pipelineRes.ok === true
                  ? null
                  : pipelineRes.erro ?? (pipelineRes.ok === false ? 'erro_pipeline_generico' : null),
            };
            savePagamentoToStorage(settingsOwnerUserId, finalizado);
            setPagamentoAtivo(finalizado);
          }

          setPagamentoConfirmadoUI(true);
          setIsPollingPagamento(false);

          toast({
            title: 'Pagamento confirmado! 🎉',
            description:
              'Recebemos a confirmação do PIX. Aguarde alguns segundos enquanto ativamos a sua funcionalidade.',
          });

          // Fechamos o dialog de forma suave após 3 segundos para o usuário curtir a animação de sucesso.
          // Usa isMountedRef (não `cancelled`) porque este mesmo setPagamentoAtivo/setPagamentoConfirmadoUI
          // acima já derruba o efeito de polling (dependências mudaram) e marcaria `cancelled=true`
          // antes deste timer disparar, impedindo o fechamento automático.
          timeoutAuto = setTimeout(() => {
            if (!isMountedRef.current) return;
            console.info('[FU Extendido Polling] Fechando dialog após confirmação (3s delay).');
            setIsAcquireDialogOpen(false);
            setSelectedPlanId(null);
            setAcquireStep(1);
            setPagamentoConfirmadoUI(false);

            // Limpa o storage pois o pagamento foi concluído
            if (settingsOwnerUserId) {
              clearPagamentoFromStorage(settingsOwnerUserId);
            }

            // Revalida os dados do usuário para trocar a tela de aquisição pelo layout ativo
            // (caso a confirmação já tenha sido processada pelo webhook)
            reloadFollowupExtendidoConfig().catch(() => void 0);
          }, 3000);
        } else if (novoStatus === 'CANCELLED' || novoStatus === 'EXPIRED') {
          console.warn(
            `[FU Extendido Polling] Pagamento em status final não pago: ${novoStatus}. Parando polling.`,
          );
          setIsPollingPagamento(false);
          if (settingsOwnerUserId) {
            clearPagamentoFromStorage(settingsOwnerUserId);
          }
        }
      } catch (err) {
        console.error(`[FU Extendido Polling] Erro na tentativa ${tentativas}:`, err);
      }
    };

    tick();
    const id = window.setInterval(tick, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (timeoutAuto) clearTimeout(timeoutAuto);
      setIsPollingPagamento(false);
      console.debug('[FU Extendido Polling] Cleanup: parado (dialog fechado / step mudou / status mudou).');
    };
  }, [
    isAcquireDialogOpen,
    acquireStep,
    pagamentoAtivo?.paymentId,
    pagamentoAtivo?.status,
    settingsOwnerUserId,
    pagamentoConfirmadoUI,
  ]);

  if (loadingFollowupExtendidoConfig) {
    return (
      <div className="w-full animate-in fade-in duration-500 pb-12 py-4 px-1 sm:px-2 md:px-3">
        <Card className="border-border bg-card shadow-sm rounded-2xl w-full">
          <CardContent className="py-10">
            <div className="text-sm text-muted-foreground text-center">Carregando...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!followupExtendidoAtivo) {
    const flowSteps = [
      {
        group: 'Uso atual',
        state: 'amber-1',
        chip: 'Etapa 1',
        title: 'O lead avança no funil',
        desc: 'O lead é atendido normalmente e chega a etapas como Contato Realizado ou Oportunidade Qualificada.',
      },
      {
        group: 'Uso atual',
        state: 'amber-2',
        chip: 'Etapa 2',
        title: 'O lead para de responder',
        desc: 'Sem retorno do lead, a operação para de insistir e ele fica parado naquela etapa do funil.',
      },
      {
        group: 'Nova funcionalidade',
        state: 'green-1',
        chip: 'Etapa 3',
        title: 'Sistema continua acompanhando',
        desc: 'O FollowUp Extendido monitora esse lead por uma janela de 7 a 360 dias sem resposta, configurável por você.',
      },
      {
        group: 'Nova funcionalidade',
        state: 'green-2',
        chip: 'Etapa 4',
        title: 'Lead reengajado automaticamente',
        desc: 'Passado o prazo configurado, um follow-up automático é enviado para tentar reengajar o lead.',
      },
    ] as const;

    const stateStyles: Record<string, { dot: string; chip: string; border: string; bg: string; title: string; desc: string }> = {
      'amber-1': {
        dot: 'bg-amber-400 ring-2 ring-amber-100',
        chip: 'bg-amber-50 text-amber-700 border-amber-200/70',
        border: 'border-amber-200/80',
        bg: 'bg-gradient-to-br from-amber-50/50 to-transparent',
        title: 'text-amber-900',
        desc: 'text-amber-900/75',
      },
      'amber-2': {
        dot: 'bg-amber-500 ring-2 ring-amber-100',
        chip: 'bg-amber-100/70 text-amber-800 border-amber-300/70',
        border: 'border-amber-300/70',
        bg: 'bg-gradient-to-br from-amber-100/50 via-amber-50/60 to-transparent',
        title: 'text-amber-950',
        desc: 'text-amber-900/80',
      },
      'green-1': {
        dot: 'bg-emerald-400 ring-2 ring-emerald-100',
        chip: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
        border: 'border-emerald-200/80',
        bg: 'bg-gradient-to-br from-emerald-50/50 to-transparent',
        title: 'text-emerald-900',
        desc: 'text-emerald-900/75',
      },
      'green-2': {
        dot: 'bg-emerald-500 ring-2 ring-emerald-100',
        chip: 'bg-emerald-100/70 text-emerald-800 border-emerald-300/70',
        border: 'border-emerald-300/70',
        bg: 'bg-gradient-to-br from-emerald-100/50 via-emerald-50/60 to-transparent',
        title: 'text-emerald-950',
        desc: 'text-emerald-900/80',
      },
    };

    return (
      <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 py-4 px-1 sm:px-2 md:px-3">
        <Card className="border-border bg-card shadow-sm rounded-2xl w-full overflow-hidden">
          {/* ===== 1 / 2 / 3 — HEADER ===== */}
          <CardHeader className="pb-6 pt-6 px-5 sm:px-6 md:px-7">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1 min-w-0 space-y-3">
                {/* 1. Etiquetas */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="inline-flex items-center gap-1.5 border-border/60 bg-muted/20 text-foreground/85 text-[11px] font-semibold"
                  >
                    <Crown className="h-3 w-3 text-emerald-600" />
                    Funcionalidade Premium
                  </Badge>
                  <Badge
                    variant="outline"
                    className="inline-flex items-center gap-1.5 border-border/60 bg-muted/10 text-foreground/75 text-[11px] font-medium"
                  >
                    <Zap className="h-3 w-3 text-indigo-600" />
                    Ativação imediata via PIX
                  </Badge>
                </div>

                {/* 2. Título + 3. Texto pequeno */}
                <div className="space-y-2">
                  <h1 className="text-base sm:text-lg font-semibold text-foreground">
                    FollowUp Extendido
                  </h1>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                    Um &ldquo;não agora&rdquo; não precisa ser um &ldquo;não para sempre&rdquo;. Continue trabalhando leads sem resposta de forma automática.
                  </p>
                </div>
              </div>

              {/* 2. Botão de Adquirir (lado direito no desktop) */}
              <div className="md:shrink-0 w-full md:w-auto flex md:justify-end">
                <Button
                  onClick={handleAcquireClick}
                  className="h-10 w-full md:w-auto px-5 rounded-lg text-xs md:text-sm font-semibold text-zinc-900 shadow-sm bg-[#EBF57D] hover:brightness-[0.97] hover:shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 ease-out"
                >
                  <Crown className="h-3.5 w-3.5 mr-1.5 text-zinc-900" />
                  Adquirir FollowUp Extendido
                </Button>
              </div>
            </div>
          </CardHeader>

          <div className="h-px w-full bg-border/60" />

          {/* ===== 4. COMO FUNCIONA — FLOW UNIFICADO ===== */}
          <CardContent className="pt-6 pb-7 px-5 sm:px-6 md:px-7">
            <style>{`
              @keyframes flowPulseHorz {
                0% { left: 0%; }
                100% { left: 100%; }
              }
              @keyframes flowGlow {
                0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.45), 0 0 8px 1px rgba(251,191,36,0.55); }
                50% { box-shadow: 0 0 0 4px rgba(34,197,94,0.0), 0 0 18px 3px rgba(16,185,129,0.55); }
              }
            `}</style>

            <section className="flow space-y-5">
              {/* flow-eyebrow */}
              <div className="flow-eyebrow text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Como funciona
              </div>

              {/* Grupos visuais de legenda — antes do flow-track */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                <div className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50/50 px-3 py-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700 shadow-sm border border-amber-200/70">
                    <XCircle className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                      Uso atual
                    </div>
                    <div className="text-[11px] text-amber-900/75 leading-snug">
                      Etapas 1 e 2 · Como o fluxo funciona sem a ferramenta
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200/70">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                      Nova funcionalidade
                    </div>
                    <div className="text-[11px] text-emerald-900/75 leading-snug">
                      Etapas 3 e 4 · O que muda com o FollowUp Extendido
                    </div>
                  </div>
                </div>
              </div>

              {/* flow-track UNIFICADO — contém pulse + 4 nodes irmãos */}
              <div className="flow-track relative pt-0">
                {/* ===== LINHA BASE do trilho (TODOS no mesmo eixo Y = top-[2.5rem]/40px centro) ===== */}
                {/* Mobile vertical — oculta (apenas horizontal desktop). Mantido apenas como fallback visual se alguém reativar, mas alinhado. */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-[2.5rem] -translate-y-1/2 hidden sm:block h-px w-full bg-gradient-to-r from-amber-300/80 via-amber-200/40 to-emerald-300/80"
                />
                {/* linha secundária 2px (efeito sulco do trilho) — mesma referência de centro */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 top-[2.5rem] -translate-y-1/2 hidden sm:block h-[2px] w-full bg-gradient-to-r from-amber-400/30 via-transparent to-emerald-400/30 opacity-80"
                />

                {/* ===== PULSE / PARTÍCULA ANIMADA — 1 única, alinhada CENTRO na linha ===== */}
                <div
                  aria-hidden="true"
                  className="pulse hidden sm:flex absolute z-20 top-[2.5rem] -translate-y-1/2 h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 via-emerald-300 to-emerald-500 border-2 border-white shadow-md items-center justify-center"
                  style={{
                    animation:
                      'flowPulseHorz 3.8s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite alternate, flowGlow 2.2s ease-in-out infinite',
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="absolute -inset-1 rounded-full bg-emerald-400/50 blur-[3px] opacity-80 pointer-events-none"
                  />
                </div>

                {/* ===== GRID UNIFICADO com os 4 nodes irmãos dentro de flow-track ===== */}
                <div className="relative grid grid-cols-1 sm:grid-cols-4 gap-6 sm:gap-4 pt-0 sm:pt-0">
                  {flowSteps.map((step, idx) => {
                    const s = stateStyles[step.state];
                    return (
                      <div
                        key={idx}
                        data-state={step.state}
                        className={`flow-node relative flex sm:flex-col items-start sm:items-stretch gap-4 sm:gap-4`}
                      >
                        {/* node-dot — CENTRALIZADO EXATO na linha do trilho.
                            Desktop: top-[2.5rem = 40px] + -translate-y-1/2 = centro exato no eixo. */}
                        <span className="node-dot relative z-10 shrink-0 sm:mx-auto sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:top-[2.5rem] sm:-translate-y-1/2">
                          <span className="inline-flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-full border-2 border-white shadow-md bg-white">
                            <span
                              className={`inline-flex h-4.5 w-4.5 sm:h-5 sm:w-5 rounded-full ring-[6px] ring-white ${s.dot}`}
                              style={{
                                boxShadow:
                                  step.state.startsWith('green')
                                    ? '0 0 0 2px rgba(16,185,129,0.15), 0 0 10px 2px rgba(16,185,129,0.25)'
                                    : '0 0 0 2px rgba(251,191,36,0.14), 0 0 9px 1px rgba(251,191,36,0.22)',
                              }}
                            />
                          </span>
                        </span>

                        {/* Conteúdo do node: node-chip + h3 + p.
                            Desktop: conteudo abaixo do node-dot; margin-top > altura do node. */}
                        <div className={`flex-1 min-w-0 rounded-2xl border ${s.border} ${s.bg} p-4 shadow-sm sm:mt-14`}>
                          <span className={`node-chip inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${s.chip}`}>
                            {step.chip}
                          </span>
                          <h3 className={`text-sm font-semibold leading-snug ${s.title}`}>
                            {step.title}
                          </h3>
                          <p className={`mt-1.5 text-[11.5px] leading-relaxed ${s.desc}`}>
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ===== RESULT STRIP — amarelo → verde ===== */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 rounded-2xl border border-dashed border-border/80 bg-gradient-to-r from-amber-50/60 via-[#EBF57D]/10 to-emerald-50/50 px-4 sm:px-6 py-3.5 mt-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1.5 text-[11.5px] font-medium shadow-sm border border-amber-200/70">
                  <XCircle className="h-3.5 w-3.5 shrink-0" />
                  Lead sem resposta
                </span>
                <ArrowRight className="h-4 w-4 text-emerald-600 shrink-0 hidden sm:block" />
                <ArrowDown className="h-4 w-4 text-emerald-600 shrink-0 sm:hidden" />
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1.5 text-[11.5px] font-semibold shadow-sm border border-emerald-200/80">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Lead reengajado automaticamente
                </span>
              </div>
            </section>
          </CardContent>
        </Card>

        <Dialog open={isAcquireDialogOpen} onOpenChange={(open) => {
          if (!open) {
            handleCloseAcquireDialog();
          } else {
            setIsAcquireDialogOpen(open);
          }
        }}>
          <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden p-0">
            <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-border/70 shrink-0">
              <div>
                <DialogTitle className="text-base font-semibold">
                  Contratar FollowUp Extendido
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Complete os passos abaixo para ativar a funcionalidade.
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="pt-4 px-5 sm:px-6 pb-0 overflow-y-auto flex-1">
              {acquireStep === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        1. Selecione o Plano
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Escolha a opção que melhor se encaixa no volume da sua operação.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-border/60 bg-muted/20 text-foreground/80 text-[11px] font-medium"
                    >
                      Passo 1 de 3
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {plans.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`relative text-left rounded-2xl border p-5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500/60 ${
                            isSelected
                              ? 'border-indigo-500/70 bg-indigo-50/40 shadow-md shadow-indigo-500/10 scale-[1.01]'
                              : 'border-border bg-card hover:border-border/80 hover:bg-muted/30'
                          }`}
                        >
                          {plan.recomendado && (
                            <Badge
                              className="absolute -top-2.5 right-4 bg-gradient-to-r from-emerald-500 to-teal-500 border-0 text-white text-[10px] font-semibold"
                            >
                              Mais escolhido
                            </Badge>
                          )}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold text-foreground">
                                {plan.nome}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex items-baseline gap-1">
                            <span className="text-xs text-muted-foreground font-medium">R$</span>
                            <span className="text-lg font-semibold">
                              {plan.preco}
                            </span>
                            <span className="text-sm text-muted-foreground font-medium">
                              /mês
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                            {plan.descricao}
                          </p>

                          <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                              O que está incluso
                            </div>
                            <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground list-disc list-inside">
                              <li>Janela de 7 a 360 dias para leads sem resposta</li>
                              <li>Filtro por etapa do funil</li>
                              <li>Histórico completo de envios</li>
                              <li>Envios automáticos via IA</li>
                            </ul>
                            <div className="mt-3 text-[11px] font-medium text-foreground/80">
                              Até {plan.volume.toLocaleString('pt-BR')} leads reativados por ciclo mensal
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2 pb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={handleCloseAcquireDialog}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={handleAcquireNext}
                        className="h-11 px-6 rounded-xl text-sm font-semibold text-zinc-900 shadow-md bg-[#EBF57D] hover:brightness-[0.96]"
                      >
                        Continuar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {acquireStep === 2 && selectedPlan && planoProrrateado && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        2. Resumo da contratação
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Confira o valor do pagamento antecipado e as próximas cobranças.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-border/60 bg-muted/20 text-foreground/80 text-[11px] font-medium"
                    >
                      Passo 2 de 3
                    </Badge>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-foreground">
                          Plano {selectedPlan.nome}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                          Volume de {selectedPlan.volume.toLocaleString('pt-BR')} leads por ciclo.
                        </p>
                      </div>
                      <div className="text-right space-y-0.5 shrink-0">
                        <div className="text-[11px] font-medium text-muted-foreground uppercase">
                          Ciclo atual
                        </div>
                        <div className="text-xs font-semibold text-foreground">
                          {planoProrrateado.inicioCiclo} até {planoProrrateado.fimCiclo}
                        </div>
                      </div>
                    </div>

                    <div className="h-px w-full bg-border/60" />

                    <div className="grid grid-cols-1 md:grid-cols-[0.95fr_1.05fr] gap-5 items-start">
                      <div className="rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/60 via-white to-emerald-50/40 p-4 space-y-3">
                        <div>
                          <div className="text-[11px] font-semibold text-indigo-700 uppercase">
                            Valor do pagamento
                          </div>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="mt-2 inline-flex items-baseline gap-1.5 cursor-help rounded-lg px-2 -mx-2 py-1 hover:bg-white/60 transition-colors">
                                  <span className="text-sm font-semibold text-emerald-700">R$</span>
                                  <span className="text-lg font-semibold text-emerald-700">
                                    {String(planoProrrateado.valorRateio.toFixed(2)).replace('.', ',')}
                                  </span>
                                  <span className="ml-1 text-[11px] text-indigo-600 font-medium">
                                    i
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="text-[11px] space-y-1 text-foreground/90 leading-relaxed">
                                  <p className="font-semibold">
                                    Como esse valor é calculado
                                  </p>
                                  <p>
                                    Consideramos o dia de vencimento da sua assinatura (dia {planoProrrateado.diaVencimento}) e calculamos um valor proporcional aos dias restantes do ciclo atual.
                                  </p>
                                  <p>
                                    Valor do plano: R$ {planoProrrateado.valorPlanoCheio.toFixed(2).replace('.', ',')} por mês.
                                  </p>
                                  <p>
                                    Dias restantes neste ciclo: {planoProrrateado.diasRestantes} de {planoProrrateado.totalDiasCiclo} dias.
                                  </p>
                                  {planoProrrateado.valorRateioAjustadoParaMinimo && (
                                    <p>
                                      O cálculo proporcional daria R$ {planoProrrateado.valorRateioCalculado.toFixed(2).replace('.', ',')}, mas o valor mínimo aceito para pagamento via PIX é R$ 5,00.
                                    </p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                            {planoProrrateado.valorRateioAjustadoParaMinimo
                              ? `Ajustado para o valor mínimo de pagamento via PIX (dias restantes até o vencimento dia ${planoProrrateado.diaVencimento}).`
                              : `Referente aos dias restantes até o vencimento dia ${planoProrrateado.diaVencimento}.`}
                          </div>
                        </div>

                        <div className="h-px w-full bg-border/60" />

                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Valor mensal</span>
                            <span className="font-medium text-foreground">
                              R$ {planoProrrateado.valorPlanoCheio.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">Dias restantes no ciclo</span>
                            <span className="font-medium text-foreground">
                              {planoProrrateado.diasRestantes} dias
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-2.5 text-[11px] text-foreground/85 leading-relaxed">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                            <p>
                              <span className="font-semibold text-foreground">Pagamento hoje:</span> o valor acima é cobrado uma única vez agora via PIX para ativar imediatamente o plano.
                            </p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 h-2 w-2 rounded-full bg-indigo-500 shrink-0" />
                            <p>
                              <span className="font-semibold text-foreground">Próximas faturas:</span> o valor cheio do plano (R$ {planoProrrateado.valorProxFatura.toFixed(2).replace('.', ',')}/mês) será automaticamente adicionado às próximas faturas da sua assinatura, no dia {planoProrrateado.diaVencimento}.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 pb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <Button type="button" variant="outline" onClick={handleAcquireBack}>
                        Voltar
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="button" variant="ghost" onClick={handleCloseAcquireDialog}>
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          onClick={handleAcquireNext}
                          className="h-11 px-6 rounded-xl text-sm font-semibold text-zinc-900 shadow-md bg-[#EBF57D] hover:brightness-[0.96]"
                        >
                          Pagar R$ {String(planoProrrateado.valorRateio.toFixed(2)).replace('.', ',')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {acquireStep === 3 && selectedPlan && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        3. Pagamento via PIX
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {pagamentoAtivo
                          ? 'Use o QR Code ou o código copia e cola para pagar. Após a confirmação a funcionalidade será ativada automaticamente.'
                          : 'Gerando QR Code do PIX para concluir a contratação...'}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-border/60 bg-muted/20 text-foreground/80 text-[11px] font-medium"
                    >
                      Passo 3 de 3
                    </Badge>
                  </div>

                  {!pagamentoAtivo && planoProrrateado && (
                    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center space-y-5">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200/60 bg-indigo-50/60 px-3 py-1.5 text-[11px] font-medium text-indigo-700">
                        Pagamento instantâneo via PIX
                      </div>
                      <div className="mx-auto h-56 w-56 rounded-2xl bg-gradient-to-br from-indigo-50/50 via-white to-emerald-50/40 border-2 border-dashed border-border/70 flex items-center justify-center shadow-sm">
                        <div className="text-center space-y-2 px-5">
                          <div className="mx-auto h-10 w-10 rounded-full bg-background/80 flex items-center justify-center shadow-sm">
                            <span className="inline-block h-5 w-5 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">
                              Gerando QR Code PIX...
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                              Aguarde alguns segundos enquanto geramos a sua cobrança.
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-xs font-semibold text-emerald-700">R$</span>
                        <span className="text-lg font-semibold text-emerald-700">
                          {String(planoProrrateado.valorRateio.toFixed(2)).replace('.', ',')}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                        <span className="font-semibold text-foreground">Plano {selectedPlan.nome} • {selectedPlan.volume.toLocaleString('pt-BR')} envios</span>
                        <span className="mx-1 text-border">·</span>
                        <span>Válido para o ciclo {planoProrrateado.inicioCiclo} até {planoProrrateado.fimCiclo}.</span>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleGerarQrCode}
                          disabled={isCreatingQrCode}
                          className="h-11 px-5 rounded-xl text-sm font-semibold"
                        >
                          {isCreatingQrCode ? (
                            <>
                              <span className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                              Gerando cobrança...
                            </>
                          ) : (
                            <>Tentar novamente</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {pagamentoAtivo && planoProrrateado && (
                    <div className="space-y-5 relative">
                      <style>{`
                        @keyframes fu-progress-bar {
                          from { width: 0%; }
                          to { width: 100%; }
                        }
                        .fu-progress-fill {
                          animation: fu-progress-bar 3s linear forwards;
                        }
                      `}</style>
                      {pagamentoConfirmadoUI && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50/95 via-white/95 to-emerald-50/95 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-500 ease-out">
                          <div className="flex flex-col items-center justify-center text-center px-6 py-10 space-y-5 max-w-sm">
                            <div className="relative">
                              <div className="absolute inset-0 h-20 w-20 rounded-full bg-emerald-400/30 animate-ping" />
                              <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-xl shadow-emerald-500/30">
                                <svg
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="h-10 w-10 text-white animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300"
                                >
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h3 className="text-lg font-semibold text-emerald-900">
                                Pagamento recebido!
                              </h3>
                              <p className="text-sm text-emerald-800/90 leading-relaxed">
                                O PIX foi confirmado. Estamos preparando a sua ativação.
                                <br />
                                <span className="text-xs text-emerald-700/80">
                                  Essa janela será fechada automaticamente em alguns segundos.
                                </span>
                              </p>
                            </div>
                            <div className="w-full max-w-xs h-1.5 rounded-full bg-emerald-200/80 overflow-hidden">
                              <div
                                className="fu-progress-fill h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-border bg-card p-6 md:p-8 text-center space-y-6">
                        {pagamentoAtivo.status === 'RECEIVED' ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Pagamento confirmado
                          </div>
                        ) : isPollingPagamento ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-semibold text-indigo-700">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500 opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-600" />
                            </span>
                            Verificando pagamento em tempo real...
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
                            Pagamento PIX gerado • aguardando confirmação
                          </div>
                        )}

                        <div className="mx-auto h-64 w-64 rounded-2xl bg-white border-2 border-border/60 flex items-center justify-center shadow-md">
                          {pagamentoAtivo.pix.base64 || pagamentoAtivo.pix.qrCodeImageUrl ? (
                            <img
                              src={
                                pagamentoAtivo.pix.base64?.startsWith('data:')
                                  ? pagamentoAtivo.pix.base64
                                  : pagamentoAtivo.pix.base64
                                    ? `data:image/png;base64,${pagamentoAtivo.pix.base64}`
                                    : (pagamentoAtivo.pix.qrCodeImageUrl || '')
                              }
                              alt="QR Code PIX FollowUp Extendido"
                              className="h-56 w-56 object-contain"
                            />
                          ) : (
                            <div className="text-center space-y-2 px-5">
                              <div className="text-sm font-semibold text-foreground">
                                Use o código copia e cola
                              </div>
                              <div className="text-[11px] text-muted-foreground leading-relaxed">
                                Copie o código PIX abaixo e cole no app do seu banco.
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-2 flex-wrap">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs font-semibold text-emerald-700">R$</span>
                            <span className="text-lg font-semibold text-emerald-700">
                              {String(pagamentoAtivo.valorRateio.toFixed(2)).replace('.', ',')}
                            </span>
                          </div>
                          <span className="text-border/80">•</span>
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Plano {selectedPlan.nome}</span>
                            <span className="mx-1 text-border/60">·</span>
                            <span>{selectedPlan.volume.toLocaleString('pt-BR')} envios</span>
                            <span className="mx-1 text-border/60">·</span>
                            <span>Ciclo {pagamentoAtivo.ciclo.inicio} até {pagamentoAtivo.ciclo.fim}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Válido até:</span>{' '}
                          {pagamentoAtivo.pix.expirationDate
                            ? new Date(pagamentoAtivo.pix.expirationDate).toLocaleString('pt-BR')
                            : 'a confirmação do pagamento'}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-xl text-sm font-semibold"
                            onClick={handleCopiarPixPayload}
                          >
                            Copiar código PIX
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-11 rounded-xl text-sm font-semibold"
                            onClick={handleDownloadPagamentoPdf}
                            disabled={isGeneratingPdf}
                          >
                            {isGeneratingPdf ? (
                              <>
                                <span className="mr-2 inline-block h-4 w-4 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                                Preparando PDF...
                              </>
                            ) : (
                              <>
                                <span aria-hidden className="mr-1.5">📄</span>
                                Baixar PDF do Pagamento
                              </>
                            )}
                          </Button>
                        </div>

                        {pagamentoAtivo.pix.payload && (
                          <div className="rounded-xl border border-border/60 bg-muted/25 p-4 text-left">
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-[10px] font-semibold text-muted-foreground uppercase">
                                Código PIX copia e cola
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 rounded-md text-[11px] font-medium text-foreground/80 hover:text-foreground"
                                onClick={handleCopiarPixPayload}
                              >
                                Copiar
                              </Button>
                            </div>
                            <div className="text-[10.5px] font-mono text-foreground/85 break-all leading-relaxed select-all rounded-lg bg-background/80 p-3 border border-border/50">
                              {pagamentoAtivo.pix.payload.match(/.{1,80}/g)?.join('\n')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 pb-6">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <Button type="button" variant="outline" onClick={handleAcquireBack}>
                        Voltar
                      </Button>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button type="button" variant="ghost" onClick={handleCloseAcquireDialog}>
                          {pagamentoAtivo ? 'Fechar e pagar depois' : 'Cancelar'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500 pb-12 py-4 px-1 sm:px-2 md:px-3">
      <Card className="border-border bg-card shadow-sm rounded-2xl w-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">FollowUp Extendido</CardTitle>
              <CardDescription>
                Configure os parâmetros e acompanhe os FollowUps enviados automaticamente para leads sem resposta.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className={`px-3 py-1 text-xs font-semibold ${
                  followupExtendidoAtivo
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                {followupExtendidoAtivo ? 'Funcionalidade Ativa' : 'Funcionalidade Inativa'}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-10">
          <TooltipProvider delayDuration={150}>
            {loadingFollowupExtendidoConfig ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                <div className="rounded-2xl border border-border/60 bg-muted/10 p-5 sm:p-6 space-y-5 order-2 lg:order-1">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-xl border border-border/60 bg-gradient-to-br from-amber-400/15 via-orange-500/15 to-rose-500/15 flex items-center justify-center">
                      <Crown className="h-4 w-4 text-orange-600 dark:text-amber-400" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-semibold text-foreground">
                        Resumo do Plano
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge
                            variant="secondary"
                            className={`px-2.5 py-0.5 text-[11px] font-semibold cursor-default ${
                              followupExtendidoAtivo
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  followupExtendidoAtivo ? 'bg-emerald-500' : 'bg-zinc-400'
                                }`}
                              />
                              {followupExtendidoAtivo ? 'Ativo' : 'Inativo'}
                            </span>
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start" className="max-w-xs text-xs">
                          Indica se a funcionalidade está habilitada para o seu plano.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="rounded-xl border border-border/60 bg-background/70 p-4 cursor-help">
                          <div className="text-[11px] font-medium text-muted-foreground">
                            Volume por ciclo
                          </div>
                          <div className="mt-1.5 text-lg font-semibold text-foreground">
                            {followupExtendidoVolume
                              ? Number(followupExtendidoVolume).toLocaleString('pt-BR')
                              : '-'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            FollowUps
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="max-w-xs text-xs">
                        Quantidade máxima de FollowUps que o plano pode enviar por ciclo.
                      </TooltipContent>
                    </Tooltip>

                    <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Ciclo atual
                      </div>
                      <div className="mt-1.5 text-sm font-semibold text-foreground">
                        <span className="whitespace-nowrap">
                          {followupExtendidoCiclo.inicioFormatado}
                        </span>
                        <span className="mx-1.5 text-muted-foreground font-normal">
                          até
                        </span>
                        <span className="whitespace-nowrap">
                          {followupExtendidoCiclo.fimFormatado}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Vencimento dia{' '}
                        <span className="font-semibold text-foreground">
                          {followupExtendidoCiclo.diaVencimentoNum !== null
                            ? String(followupExtendidoCiclo.diaVencimentoNum)
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/80 p-4 sm:p-5 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">
                          FollowUps do ciclo
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          <span className="whitespace-nowrap">
                            {followupExtendidoCiclo.inicioFormatado}
                          </span>
                          <span className="mx-1">até</span>
                          <span className="whitespace-nowrap">
                            {followupExtendidoCiclo.fimFormatado}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[11px] font-medium text-muted-foreground">
                          Utilização
                        </div>
                        <div className="text-sm font-semibold text-foreground">
                          <span className="text-emerald-600">
                            {followupExtendidoCiclo.enviadosCiclo.toLocaleString('pt-BR')}
                          </span>
                          <span className="text-muted-foreground font-normal">
                            {' '}
                            /{' '}
                          </span>
                          <span>
                            {followupExtendidoCiclo.volumeValido > 0
                              ? followupExtendidoCiclo.volumeValido.toLocaleString('pt-BR')
                              : followupExtendidoVolume
                              ? Number(followupExtendidoVolume).toLocaleString('pt-BR')
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/70">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-all"
                          style={{
                            width: `${followupExtendidoCiclo.progressoCiclo}%`,
                          }}
                          role="progressbar"
                          aria-valuenow={Math.round(followupExtendidoCiclo.progressoCiclo)}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[11px]">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          Enviados
                          <span className="ml-auto font-semibold text-foreground">
                            {followupExtendidoCiclo.enviadosCiclo.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="h-2 w-2 rounded-full bg-orange-500" />
                          Pendentes
                          <span className="ml-auto font-semibold text-foreground">
                            {followupExtendidoCiclo.volumeValido > 0
                              ? followupExtendidoCiclo.pendentesCiclo.toLocaleString('pt-BR')
                              : followupExtendidoVolume
                              ? Number(followupExtendidoVolume).toLocaleString('pt-BR')
                              : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/10 p-5 sm:p-6 space-y-5 order-1 lg:order-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-xl border border-border/60 bg-gradient-to-br from-sky-400/15 via-indigo-500/15 to-violet-500/15 flex items-center justify-center">
                        <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">
                          Configuração de Dias
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Ajuste a janela de busca por leads sem resposta para recontato.
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`px-3 py-1 text-[11px] font-semibold shrink-0 ${
                        followupExtendidoDiasPerdidos
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {followupExtendidoDiasPerdidos
                        ? `${Number(followupExtendidoDiasPerdidos).toLocaleString('pt-BR')} dia${Number(followupExtendidoDiasPerdidos) === 1 ? '' : 's'}`
                        : 'Não definido'}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/70 p-4 sm:p-5 space-y-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-sm font-semibold text-foreground cursor-help">
                          Dias sem resposta para buscar leads
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-xs">
                        Exemplo: 30 = considera leads sem resposta há até 30 dias para recontato (mínimo 7, máximo 360).
                      </TooltipContent>
                    </Tooltip>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                      <div className="flex-1 min-w-0">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={7}
                          max={360}
                          placeholder="Ex: 30"
                          value={followupExtendidoDiasPerdidos}
                          onChange={(e) => setFollowupExtendidoDiasPerdidos(e.target.value)}
                          disabled={!isEditingFollowupExtendidoDias}
                          className="bg-background border-border rounded-xl disabled:opacity-70"
                        />
                      </div>
                      {!isEditingFollowupExtendidoDias ? (
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingFollowupExtendidoDias(true)}
                          className="rounded-xl sm:shrink-0"
                        >
                          Editar
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSaveFollowupExtendidoConfig}
                          disabled={isSavingFollowupExtendidoConfig || loadingFollowupExtendidoConfig}
                          className="rounded-xl sm:shrink-0"
                        >
                          {isSavingFollowupExtendidoConfig ? 'Salvando...' : 'Salvar'}
                        </Button>
                      )}
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-1">
                      <span className="inline-block h-1.5 w-1.5 mt-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                      <div className="space-y-2 min-w-0 break-words overflow-wrap-anywhere leading-relaxed">
                        <p>
                          Defina por quantos dias o lead pode ficar sem responder, dentro das etapas selecionadas, antes de receber um novo follow-up automático.
                        </p>
                        <p>
                          <strong className="font-semibold text-foreground/80">Exemplo:</strong> se você configurar 30 dias, o sistema envia um follow-up automático para leads que estão há 30 dias sem resposta nas etapas selecionadas.
                        </p>
                        <p>
                          <strong className="font-semibold text-foreground/80">Período:</strong> mínimo de 7 dias e máximo de 360 dias.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/10 p-5 sm:p-6 space-y-5 lg:col-span-2 order-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 shrink-0 rounded-xl border border-border/60 bg-gradient-to-br from-emerald-400/15 via-teal-500/15 to-cyan-500/15 flex items-center justify-center">
                        <BarChart3 className="h-4 w-4 text-teal-600 dark:text-teal-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground">
                          Configuração de Etapas
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Escolha em quais etapas do funil o lead precisa estar para receber o FollowUp Extendido.
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`px-3 py-1 text-[11px] font-semibold shrink-0 ${
                        followupExtendidoEtapas.length > 0
                          ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100'
                      }`}
                    >
                      {followupExtendidoEtapas.length > 0
                        ? `${followupExtendidoEtapas.length} etapa${followupExtendidoEtapas.length === 1 ? '' : 's'}`
                        : 'Não definido'}
                    </Badge>
                  </div>

                  <div className="rounded-xl border border-border/50 bg-background/70 p-4 sm:p-5 space-y-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Label className="text-sm font-semibold text-foreground cursor-help">
                          Etapas do funil elegíveis
                        </Label>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start" className="max-w-xs text-xs">
                        Somente leads que estiverem em uma das etapas marcadas vão receber o FollowUp Extendido.
                      </TooltipContent>
                    </Tooltip>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {PIPELINE_STAGES.map((stage) => {
                        const checked = followupExtendidoEtapas.includes(stage.name);
                        return (
                          <label
                            key={stage.id}
                            className={`flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm ${
                              isEditingFollowupExtendidoEtapas ? 'cursor-pointer' : 'cursor-default opacity-80'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!isEditingFollowupExtendidoEtapas}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setFollowupExtendidoEtapas((prev) =>
                                  isChecked
                                    ? [...prev, stage.name]
                                    : prev.filter((nome) => nome !== stage.name),
                                );
                              }}
                              className="h-4 w-4 rounded border border-input bg-background accent-black shrink-0"
                            />
                            <span className="truncate">{stage.name}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="flex justify-end">
                      {!isEditingFollowupExtendidoEtapas ? (
                        <Button
                          variant="outline"
                          onClick={() => setIsEditingFollowupExtendidoEtapas(true)}
                          className="rounded-xl"
                        >
                          Editar
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSaveFollowupExtendidoConfig}
                          disabled={isSavingFollowupExtendidoConfig || loadingFollowupExtendidoConfig}
                          className="rounded-xl"
                        >
                          {isSavingFollowupExtendidoConfig ? 'Salvando...' : 'Salvar'}
                        </Button>
                      )}
                    </div>

                    <div className="flex items-start gap-2 text-[11px] text-muted-foreground pt-1">
                      <span className="inline-block h-1.5 w-1.5 mt-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                      <div className="space-y-2 min-w-0 break-words overflow-wrap-anywhere leading-relaxed">
                        <p>
                          Defina em quais etapas do funil o lead precisa estar para ser elegível ao FollowUp Extendido.
                        </p>
                        <p>
                          <strong className="font-semibold text-foreground/80">Exemplo:</strong> marcando "Contato Realizado" e "Oportunidade Qualificada", só leads nessas duas etapas entram no envio.
                        </p>
                        <p>
                          <strong className="font-semibold text-foreground/80">Obrigatório:</strong> selecione ao menos uma etapa.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TooltipProvider>

          <div className="rounded-2xl border border-border/60 bg-muted/10 p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl border border-border/60 bg-muted/30 p-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-base font-semibold">Histórico de FollowUps enviados</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Somente registros confirmados com followup_extendido = true.
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                {loadingFollowupExtendidoHistorico
                  ? 'Carregando...'
                  : `${followupExtendidoHistorico.length} registro${
                      followupExtendidoHistorico.length === 1 ? '' : 's'
                    }`}
              </div>
            </div>

            {loadingFollowupExtendidoHistorico ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : followupExtendidoHistorico.length === 0 ? (
              <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-6 text-sm text-muted-foreground">
                Nenhum FollowUp Extendido enviado ainda.
              </div>
            ) : (
              <TooltipProvider delayDuration={150}>
                <div className="rounded-xl border border-border/50 shadow-sm overflow-hidden w-full max-w-full overflow-x-auto">
                  <Table className="w-full min-w-[960px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead className="max-w-[320px]">Item Interesse</TableHead>
                        <TableHead className="max-w-[320px]">Item Novo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {followupExtendidoHistorico.map((row, idxHist) => {
                        const keyId = String(
                          (row as any).idx !== undefined && (row as any).idx !== null
                            ? `${(row as any).idx}-${(row as any).lead_id ?? idxHist}-${(row as any).criado_em ?? idxHist}`
                            : `${idxHist}-${(row as any).lead_id ?? idxHist}-${(row as any).criado_em ?? idxHist}`
                        );
                        const criado = (row as any).criado_em
                          ? new Date(String((row as any).criado_em)).toLocaleString('pt-BR')
                          : '-';
                        const nome = String((row as any).lead_nome_pessoa || '').trim() || '-';
                        const telefoneRaw = String((row as any).lead_telefone || '').trim();
                        const leadId = String((row as any).lead_id || '').trim();
                        const telefone = telefoneRaw
                          ? formatPhone(telefoneRaw.replace(/\D/g, ''))
                          : '-';
                        const interesse = String((row as any).item_interesse || '').trim() || '-';
                        const itemNovo = String((row as any).item_novo || '').trim() || '-';

                        const handleAbrirLead = (e: React.MouseEvent) => {
                          e.preventDefault();
                          if (!leadId) return;
                          console.debug('[FollowUp Extendido] Abrir página do lead:', { leadId, nome });
                          navigate(`/lead/${leadId}`);
                        };

                        return (
                          <TableRow
                            key={keyId}
                            onClick={leadId ? handleAbrirLead : undefined}
                            className={
                              leadId
                                ? 'cursor-pointer transition-colors duration-150 hover:bg-muted/40'
                                : 'cursor-default'
                            }
                          >
                            <TableCell className="whitespace-nowrap">{criado}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-xl bg-brand-bg flex items-center justify-center shrink-0">
                                  <User size={14} className="text-black/70" />
                                </div>
                                <span
                                  className="text-sm font-medium text-foreground max-w-[220px] truncate"
                                  title={nome}
                                >
                                  {nome}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm text-foreground">
                              {telefone}
                            </TableCell>
                            <TableCell className="max-w-[320px]">
                              <div
                                className="text-xs text-muted-foreground whitespace-pre-wrap break-words break-all overflow-wrap-anywhere w-full max-w-full"
                                title={interesse}
                              >
                                {interesse}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-[320px]">
                              <div
                                className="text-xs font-medium text-foreground whitespace-pre-wrap break-words break-all overflow-wrap-anywhere w-full max-w-full"
                                title={itemNovo}
                              >
                                {itemNovo}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
