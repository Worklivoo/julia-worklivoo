import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { asaasFetch, getAsaasApiKey, shouldRequireAsaasApiKey } from '@/utils/asaas';
import { createPagamentoStorage } from './storage';
import type { FollowUpPagamento, FollowUpPagamentoStatus } from './types';
import type { FollowUpKind } from './kinds';
import { buildPagamentoPdfHtml } from './buildPagamentoPdfHtml';

export interface UserPagamentoConfig {
    id_cliente_asaas: string;
    id_assinatura_asaas: string;
    dia_vencimento: string;
    user_valor_mensal: number;
    user_nome?: string;
    user_empresa?: string;
}

/** O que o fluxo de pagamento precisa da configuração da aba (que fica em cada hook de config). */
export interface PagamentoConfigAdapter {
  userPagamentoConfig: UserPagamentoConfig | null;
  setUserPagamentoConfig: Dispatch<SetStateAction<UserPagamentoConfig | null>>;
  setLoading: (value: boolean) => void;
  setAtivo: (value: boolean) => void;
  setVolume: (value: string) => void;
  setDiasPerdidos: (value: string) => void;
}

interface Params {
  kind: FollowUpKind;
  user: any;
  settingsOwnerUserId: string | null;
  config: PagamentoConfigAdapter;
}

/** Contratação de um FollowUp pago: planos, rateio, cobrança PIX, polling e ativação. */
export const useFollowUpPagamento = ({ kind, user, settingsOwnerUserId, config }: Params) => {
  const { toast } = useToast();
  const { userPagamentoConfig, setUserPagamentoConfig, setLoading, setAtivo, setVolume, setDiasPerdidos } = config;
  const store = useMemo(() => createPagamentoStorage(kind), [kind]);

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

  const [isAcquireDialogOpen, setIsAcquireDialogOpen] = useState<boolean>(false);
  const [acquireStep, setAcquireStep] = useState<1 | 2 | 3>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [isAdvancingToStep3, setIsAdvancingToStep3] = useState<boolean>(false);

  const [pagamentoAtivo, setPagamentoAtivo] = useState<FollowUpPagamento | null>(null);
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
        descricao: kind.planDescricao.essencial,
      },
      {
        id: 'pro',
        nome: 'Pro',
        volume: 100,
        preco: 190,
        descricao: kind.planDescricao.pro,
        recomendado: true,
      },
      {
        id: 'empresarial',
        nome: 'Empresarial',
        volume: 300,
        preco: 490,
        descricao: kind.planDescricao.empresarial,
      },
    ];
    console.debug(`[${kind.logTag} Init] Planos carregados (precos R$ 99, R$ 190, R$ 490):`, list.map(p => `${p.id} R$${p.preco} / ${p.volume} reativacoes`));
    return list;
  }, [kind]);

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

  // ===== ETAPA 1.4: Retomada automatica do fluxo pelo localStorage =====
  useEffect(() => {
    if (!settingsOwnerUserId) return;

    const storagePagamento = store.load(settingsOwnerUserId);
    if (!storagePagamento) {
      console.debug(`[${kind.logTag} Restore] Nenhum storage encontrado, seguindo fluxo normal.`);
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
        `[${kind.logTag} Restore] ⚠️ Pagamento RECEIVED sem pipeline! Executando ativação agora. externalRef=${storagePagamento.externalReference}`,
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

      finalizarAposPagamento(storagePagamento).catch(() => void 0);
      return;
    }

    // ============================================================
    // CASO 2: Pagamento continua PENDING (QR não pago ainda) → retoma no step 3
    // ============================================================
    if (storagePagamento.status === 'PENDING') {
      console.info(
        `[${kind.logTag} Restore] Storage encontrado: status=PENDING. pagamento_id=${storagePagamento.paymentId}. externalRef=${storagePagamento.externalReference}. Retomando automaticamente no passo 3 (QR Code).`,
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
      `[${kind.logTag} Restore] Storage encontrado mas status=${storagePagamento.status}; pipelineExecutado=${storagePagamento.pipelineExecutado === true}. Limpando storage.`,
    );
    store.clear(settingsOwnerUserId);
  }, [settingsOwnerUserId]);

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
        console.debug(`[FollowUp ${kind.nome}] Cálculo de rateio (etapa 2):`, {
          plano: selectedPlan.id,
          valor_plano_cheio: selectedPlan.preco,
          dia_vencimento_usuario: user?.dia_vencimento ?? null,
          ...(planoProrrateado ?? {}),
        });
      }
      const nextStep = (acquireStep + 1) as 1 | 2 | 3;

      if (nextStep === 3) {
        if (isAdvancingToStep3 || isCreatingQrCode) {
          console.info(`[${kind.logTag} StepAuto] Já em avanço p/ passo 3 ou criando QR. Ignorando clique duplicado.`, {
            isAdvancingToStep3, isCreatingQrCode,
          });
          return;
        }
        if (pagamentoAtivo) {
          console.info(`[${kind.logTag} StepAuto] Pagamento já existe, só navegar (não criar nova cobrança).`);
          setAcquireStep(nextStep);
          return;
        }
        setIsAdvancingToStep3(true);
      }

      setAcquireStep(nextStep);

      if (nextStep === 3) {
        queueMicrotask(() => {
          if (!pagamentoAtivo && !isCreatingQrCode) {
            console.info(`[${kind.logTag} StepAuto] Passo 3 carregado. Disparando handleGerarQrCode automaticamente.`);
            void handleGerarQrCode().finally(() => {
              setIsAdvancingToStep3(false);
            });
          } else {
            console.info(`[${kind.logTag} StepAuto] Passo 3 carregado mas pagamentoAtivo/criando já existe. Nada a fazer.`, {
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
        `[${kind.logTag} PIX] Copiar payload OK. externalRef=${pagamentoAtivo.externalReference}; tamanho=${pagamentoAtivo.pix.payload.length}`,
      );
      toast({
        title: 'Código copiado!',
        description: 'Cole o código PIX no aplicativo do seu banco para pagar.',
      });
    } catch (err) {
      console.error(`[${kind.logTag} PIX] Erro ao copiar payload PIX:`, err);
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
        `[${kind.logTag} PDF] Iniciando geracao. correlationId=${correlationId}; externalRef=${pagamentoAtivo.externalReference}`,
      );

      const hojeStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const suggestedFileName = `${kind.pdfFileName}_${hojeStr}.pdf`;

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

      const html = buildPagamentoPdfHtml({ qrImgSrc, payloadQuebrado });

      win.document.open();
      win.document.write(html);
      win.document.close();

      console.info(
        `[${kind.logTag} PDF] Janela aberta. correlationId=${correlationId}; suggestedFileName="${suggestedFileName}"`,
      );

      toast({
        title: 'PDF preparado',
        description: 'Na janela aberta, clique em "Salvar PDF".',
      });
    } catch (err) {
      console.error(`[${kind.logTag} PDF] Erro ao preparar PDF:`, err);
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
        `[${kind.logTag} ASAAS] userPagamentoConfig nao carregado ou vazios. Executando SELECT de refresh antes da guard clause.`,
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
          console.info(`[${kind.logTag} ASAAS] userPagamentoConfig atualizado por refresh no handleGerarQrCode.`);
        }
      } catch (e: any) {
        console.error(`[${kind.logTag} ASAAS] Erro no SELECT refresh antes de guard clause:`, e?.message || e);
      }
    }

    if (!idClienteAsaas) {
      console.error(
        `[${kind.logTag} ASAAS] Guard clause: id_cliente_asaas ausente. user_id=${settingsOwnerUserId}`,
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
        `[${kind.logTag} ASAAS] Guard clause: id_assinatura_asaas ausente. user_id=${settingsOwnerUserId}`,
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
    const correlationId = `${kind.externalRefPrefix}_${settingsOwnerUserId}_${Date.now()}`;
    const timestampUnix = Math.floor(Date.now() / 1000);
    const externalReference = `${kind.externalRefPrefix}_${selectedPlan.id}_${settingsOwnerUserId}_${timestampUnix}`;

    const valorRateioCentavos = Math.round(Number(planoProrrateado.valorRateio) * 100);
    const valorPlanoCheioCentavos = Math.round(Number(planoProrrateado.valorPlanoCheio) * 100);
    const valorProxFaturaCentavos = Math.round(Number(planoProrrateado.valorProxFatura) * 100);

    console.groupCollapsed(`[${kind.logTag} ASAAS] ${correlationId} — Criar cobrança PIX`);
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
      description: `FollowUp ${kind.nome} - Plano ${selectedPlan.nome} - Ciclo ${planoProrrateado.inicioCiclo} a ${planoProrrateado.fimCiclo} (ativação imediata)`,
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
      // conflito de idempotência ao reativar funcionalidade (ex: a flag do FollowUp desligada e tenta de novo).
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
        `[${kind.logTag} ASAAS] ${correlationId} — Idempotency-Key (48 chars max) = "${idempotencyKeySafe}" (tamanho=${idempotencyKeySafe.length}).`,
      );

      const bodyPagamento = {
        customer: idClienteAsaas,
        billingType: 'PIX',
        value: Number(planoProrrateado.valorRateio.toFixed(2)),
        dueDate: new Date().toISOString().split('T')[0],
        externalReference,
        description: `FollowUp ${kind.nome} (Ativação)`,
        postalService: false,
      };

      console.info(
        `[${kind.logTag} ASAAS] ${correlationId} — Criando pagamento via asaasFetch. endpoint=POST /payments; value=${bodyPagamento.value}; customer=${bodyPagamento.customer.slice(0,6)}...${bodyPagamento.customer.slice(-4)}`,
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
          `[${kind.logTag} ASAAS] ${correlationId} — POST /payments retornou 409 CONFLICT (idempotency/externalRef ja utilizado). Buscando cobrança existente por externalReference=${externalReference} ...`,
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
                `[${kind.logTag} ASAAS] ${correlationId} — 409 resolvido: encontrada cobrança existente ${primeira.id}. status=${primeira.status}.`,
              );
            }
          }
        } catch (buscaErr) {
          console.warn(
            `[${kind.logTag} ASAAS] ${correlationId} — 409 mas falhou ao buscar externalReference.`,
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
          `[${kind.logTag} ASAAS] ${correlationId} — POST /payments falhou:`,
          { status: statusCriar, preview: t.slice(0, 400) },
        );
        throw new Error(msg || `Asaas retornou status ${statusCriar}`);
      }

      // Se não tivermos pagamentoAsaas ainda (caso 200/201 normal), parse o body da response:
      if (!pagamentoAsaas) {
        try {
          pagamentoAsaas = await respCriar.json();
        } catch {
          pagamentoAsaas = null;
        }
      }

      const asaasPaymentId = String(pagamentoAsaas?.id || '').trim();
      const asaasStatus = String(pagamentoAsaas?.status || 'PENDING')
        .trim()
        .toUpperCase();

      if (!asaasPaymentId) {
        console.error(
          `[${kind.logTag} ASAAS] ${correlationId} — Pagamento criado sem ID?`,
          pagamentoAsaas,
        );
        throw new Error('A plataforma de pagamento não retornou o ID da cobrança.');
      }

      console.info(
        `[${kind.logTag} ASAAS] ${correlationId} — Pagamento criado. payment_id=${asaasPaymentId}; status_asaas=${asaasStatus}. Buscando pixQrCode...`,
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
            `[${kind.logTag} ASAAS] ${correlationId} — GET pixQrCode status=${qrResp.status}; tentando extrair direto do body do pagamento...`,
          );
          pixPayload = String(pagamentoAsaas?.pix?.payload || pagamentoAsaas?.pix?.qrCode?.payload || '').trim();
          pixBase64 = String(pagamentoAsaas?.pix?.qrCode?.encodedImage || pagamentoAsaas?.pix?.qrCode?.base64 || '').trim() || null;
          pixQrUrl = String(pagamentoAsaas?.pix?.qrCode?.url || pagamentoAsaas?.pix?.qrCodeImageUrl || '').trim() || null;
          pixExpiration = pagamentoAsaas?.pix?.qrCode?.expirationDate || pagamentoAsaas?.dueDate || null;
          pixExpiration = pixExpiration ? new Date(String(pixExpiration)).toISOString() : null;
        }
      } catch (e: any) {
        console.warn(
          `[${kind.logTag} ASAAS] ${correlationId} — Erro ao buscar pixQrCode (NÃO FATAL se payload estiver em pagamentoAsaas):`,
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

      const statusNormalizado: FollowUpPagamentoStatus = (() => {
        if (asaasStatus === 'RECEIVED' || asaasStatus === 'CONFIRMED') return 'RECEIVED';
        if (asaasStatus === 'OVERDUE' || asaasStatus === 'EXPIRED') return 'EXPIRED';
        if (asaasStatus === 'DELETED' || asaasStatus === 'CANCELLED') return 'CANCELLED';
        return 'PENDING';
      })();

      const pagamento: FollowUpPagamento = {
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

      store.save(settingsOwnerUserId, pagamento);
      setPagamentoAtivo(pagamento);

      console.info(
        `[${kind.logTag} ASAAS] ${correlationId} — Cobrança REAL criada com sucesso. payment_id=${pagamento.paymentId}; externalRef=${pagamento.externalReference}; status=${pagamento.status}. Salvo no localStorage.`,
      );

      toast({
        title: 'QR Code gerado!',
        description:
          'Realize o pagamento via PIX. Quando confirmado, a funcionalidade será ativada automaticamente.',
      });
    } catch (err: any) {
      console.error(`[${kind.logTag} ASAAS] ${correlationId} — Erro ao criar cobrança:`, err);
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

  const reloadConfig = async () => {
    if (!settingsOwnerUserId) return;
    console.debug(`[${kind.logTag} Refresh] Revalidando configuração do usuário (polling / pós-confirmação)...`);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('usuarios_v2')
        .select(`${kind.columns.ativo}, ${kind.columns.volume}, ${kind.columns.dias}`)
        .eq('user_id', settingsOwnerUserId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const row = data as any;
        const ativo = Boolean(row?.[kind.columns.ativo] ?? false);
        const volume =
          row?.[kind.columns.volume] === null || row?.[kind.columns.volume] === undefined
            ? ''
            : String(row[kind.columns.volume]);
        const dias =
          row?.[kind.columns.dias] === null || row?.[kind.columns.dias] === undefined
            ? ''
            : String(row[kind.columns.dias]);
        setAtivo(ativo);
        setVolume(volume);
        setDiasPerdidos(dias);
        console.info(`[${kind.logTag} Refresh] Configuração recarregada:`, {
          [kind.columns.ativo]: ativo,
          volume,
          dias_perdidos: dias,
        });
      }
    } catch (err: any) {
      console.error(`[${kind.logTag} Refresh] Erro ao revalidar configuração:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Ativação feita no servidor (n8n). Aqui só aguardamos a flag ligar e atualizamos a tela.
  const finalizarAposPagamento = async (pagamento: any) => {
    const owner = settingsOwnerUserId;
    if (!owner) return;
    let ativado = false;
    const limite = Date.now() + 90000;
    while (Date.now() < limite && isMountedRef.current) {
      try {
        const { data } = await supabase
          .from('usuarios_v2')
          .select(kind.columns.ativo)
          .eq('user_id', owner)
          .maybeSingle();
        if ((data as any)?.[kind.columns.ativo] === true) {
          ativado = true;
          break;
        }
      } catch (err) {
        console.warn(`[${kind.logTag}] Erro ao consultar ativação (tentando novamente):`, err);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    // Desmontou: mantém o storage; ao voltar à tela o restore retoma a espera.
    if (!isMountedRef.current) return;

    store.clear(owner);
    if (ativado) {
      toast({
        title: 'Funcionalidade ativada! 🎉',
        description: 'Tudo certo, sua funcionalidade premium foi liberada!',
      });
    } else {
      toast({
        title: 'Pagamento confirmado!',
        description:
          'Seu pagamento foi recebido e a ativação está sendo finalizada. Se em alguns minutos ela não aparecer, contate o suporte com o código: ' +
          pagamento.externalReference,
      });
    }
    setTimeout(() => {
      if (!isMountedRef.current) return;
      setIsAcquireDialogOpen(false);
      setSelectedPlanId(null);
      setAcquireStep(1);
      setPagamentoConfirmadoUI(false);
      reloadConfig().catch(() => void 0);
    }, ativado ? 2000 : 500);
  };

  const pollStatusPagamentoOnce = async (
    pagamento: FollowUpPagamento,
  ): Promise<{ novoStatus: FollowUpPagamentoStatus; rawResponse?: any }> => {
    const correlationId = `POLL_${pagamento.externalReference}_${Date.now()}`;
    console.debug(
      `[${kind.logTag} Polling] ${correlationId} — Consultando status pagamento_id=${pagamento.paymentId} via asaasFetch /payments`,
    );

    try {
      const apiKey = getAsaasApiKey();
      if (shouldRequireAsaasApiKey() && !apiKey) {
        console.warn(
          `[${kind.logTag} Polling] ${correlationId} — shouldRequireAsaasApiKey=true mas sem chave frontend. Tentando mesmo assim (proxy injeta no servidor)...`,
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
          `[${kind.logTag} Polling] ${correlationId} — Erro ao consultar por ID, tentando externalReference...`,
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
            `[${kind.logTag} Polling] ${correlationId} — Erro ao consultar por externalReference:`,
            e,
          );
        }
      }

      const statusNormalizado: FollowUpPagamentoStatus = (() => {
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
        `[${kind.logTag} Polling] ${correlationId} — Exceçao no polling, mantendo status atual:`,
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
      `[${kind.logTag} Polling] Iniciando ciclo de polling para pagamento_id=${pagamentoAtivo.paymentId} externalRef=${pagamentoAtivo.externalReference}. Intervalo=3s.`,
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
        const { novoStatus } = await pollStatusPagamentoOnce(snapAtivo);
        if (cancelled) return;

        const atualizado: FollowUpPagamento = {
          ...snapAtivo,
          status: novoStatus,
          lastPolledAt: Date.now(),
        };

        if (novoStatus !== snapAtivo.status) {
          console.info(
            `[${kind.logTag} Polling] Status alterado: ${snapAtivo.status} → ${novoStatus}. pagamento_id=${snapAtivo.paymentId}`,
          );
        } else {
          console.debug(
            `[${kind.logTag} Polling] Tentativa ${tentativas} — status continua ${novoStatus}.`,
          );
        }

        if (settingsOwnerUserId) {
          store.save(settingsOwnerUserId, atualizado);
        }
        setPagamentoAtivo(atualizado);

        if (novoStatus === 'RECEIVED') {
          console.groupCollapsed(
            `🎉 [${kind.logTag} Polling] Pagamento CONFIRMADO (via polling UI). externalRef=${atualizado.externalReference}`,
          );
          console.info('pagamento_id:', atualizado.paymentId);
          console.info('valorRateio (R$):', atualizado.valorRateio);
          console.info('valorProxFatura (R$):', atualizado.valorProxFatura);
          console.info('planoId:', atualizado.planoId);
          console.info('ciclo:', atualizado.ciclo);
          console.groupEnd();

          // A ativação é feita no servidor (automação n8n "Pagamentos Recebidos (FollowUps)").
          // O front apenas mostra a confirmação e aguarda a flag ser ligada.
          setPagamentoConfirmadoUI(true);
          setIsPollingPagamento(false);
          toast({
            title: 'Pagamento confirmado! 🎉',
            description: 'Recebemos o PIX. Estamos preparando a ativação da sua funcionalidade...',
          });
          finalizarAposPagamento(atualizado).catch(() => void 0);
        } else if (novoStatus === 'CANCELLED' || novoStatus === 'EXPIRED') {
          console.warn(
            `[${kind.logTag} Polling] Pagamento em status final não pago: ${novoStatus}. Parando polling.`,
          );
          setIsPollingPagamento(false);
          if (settingsOwnerUserId) {
            store.clear(settingsOwnerUserId);
          }
        }
      } catch (err) {
        console.error(`[${kind.logTag} Polling] Erro na tentativa ${tentativas}:`, err);
      }
    };

    tick();
    const id = window.setInterval(tick, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (timeoutAuto) clearTimeout(timeoutAuto);
      setIsPollingPagamento(false);
      console.debug(`[${kind.logTag} Polling] Cleanup: parado (dialog fechado / step mudou / status mudou).`);
    };
  }, [
    isAcquireDialogOpen,
    acquireStep,
    pagamentoAtivo?.paymentId,
    pagamentoAtivo?.status,
    settingsOwnerUserId,
    pagamentoConfirmadoUI,
  ]);


  return {
    isMountedRef,
    isAcquireDialogOpen,
    setIsAcquireDialogOpen,
    acquireStep,
    setAcquireStep,
    selectedPlanId,
    setSelectedPlanId,
    isAdvancingToStep3,
    setIsAdvancingToStep3,
    pagamentoAtivo,
    setPagamentoAtivo,
    isCreatingQrCode,
    setIsCreatingQrCode,
    isGeneratingPdf,
    setIsGeneratingPdf,
    isPollingPagamento,
    setIsPollingPagamento,
    pagamentoConfirmadoUI,
    setPagamentoConfirmadoUI,
    plans,
    selectedPlan,
    planoProrrateado,
    handleAcquireClick,
    handleAcquireNext,
    handleAcquireBack,
    handleCloseAcquireDialog,
    handleCopiarPixPayload,
    handleDownloadPagamentoPdf,
    handleGerarQrCode,
    reloadConfig,
    finalizarAposPagamento,
    pollStatusPagamentoOnce,
  };
};

export type FollowUpPagamentoCtx = ReturnType<typeof useFollowUpPagamento>;
