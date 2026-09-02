// ============================================================
// Edge Function: asaas-webhook-followup-dinamico
// FONTE DA VERDADE para confirmação de pagamento do FollowUp Dinâmico.
//
// Pipeline (ORDEM OBRIGATÓRIA, vide projeto e PLANO_IMPLEMENTACAO_FOLLOWUP_DINAMICO.md):
//   0) Validar segredo do webhook (ASAAS_WEBHOOK_SECRET) via header asaas-access-token
//   1) Filtrar evento: apenas 'PAYMENT_RECEIVED' (também aceitamos PAYMENT_CONFIRMED
//      por segurança, visto que a nomenclatura varia por ambiente do Asaas)
//   2) Parse do pagamento (id, externalReference, value em centavos, status)
//   3) Extrair userId do externalReference -> padrão FU_DINAMICO_[USER_ID]_[TS]
//   4) Buscar dados ATUAIS de usuarios_v2
//   5) GUARD CLAUSE: se followup_dinamico já for TRUE -> retorna 200 sem fazer nada
//   6) Calcular novoValorMensal: user_valor_mensal_atual + precoPlano
//   7) UPDATE usuarios_v2 SET user_valor_mensal = novoValorMensal, followup_dinamico = true
//   8) Buscar e DELETAR cobranças FUTURAS PENDENTES da assinatura Asaas
//   9) PATCH /subscriptions/{id_assinatura_asaas} com o novo valor em CENTAVOS
//  10) Resposta 200 + logs de auditoria
//
// IMPORTANTE: Essa edge é a ÚNICA responsável por alterar banco e API Asaas.
// O frontend (polling/UI) NUNCA toca nesses dados.
// ============================================================

// Declaração global de compatibilidade (funciona em runtime Deno real e resolve warnings de IDE
// quando o projeto TypeScript principal lê o arquivo sem as libs do Deno).
// @ts-ignore - global Deno existe em runtime Supabase Edge Functions / Deno
declare global { const Deno: any; }
// @ts-ignore - Request é global em Deno
type RequestType = any;

// Required runtime imports (Edge Functions Supabase)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - URL imports Deno não são resolvíveis fora do runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// =============== HELPERS ===============

const maskKey = (v: string | null | undefined, head = 6, tail = 4) => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  if (t.length <= head + tail) return `${t.slice(0, 1)}...${t.slice(-1)}`;
  return `${t.slice(0, head)}...${t.slice(-tail)}`;
};

const hojeIso = (offset = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split('T')[0];
};

const CENTAVOS_PARA_REAIS = (c: number) => (Number(c) || 0) / 100;
const REAIS_PARA_CENTAVOS = (r: number) => Math.round((Number(r) || 0) * 100);

// Tabela de planos (DEVE BATER com o componente FollowUpDinamicoTab.tsx)
const PLANOS_PRECOS: Record<string, number> = {
  essencial: 5,
  pro: 6,
  empresarial: 7,
};

// =============== HTTP HANDLER ===============

serve(async (req: RequestType) => {
  const startedAt = Date.now();

  // Liberar CORS (ajuste para produção se necessário — Asaas não enviam CORS em webhooks,
  // mas adicionamos para debug local / chamadas manuais de teste)
  const ifPreflight = req.method === 'OPTIONS';
  const baseCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, asaas-access-token, idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (ifPreflight) return new Response('ok', { status: 204, headers: baseCors });

  // =============== PASSO 0) Cabeçalhos + secrets necessários ===============
  const ASAAS_WEBHOOK_SECRET = (Deno.env.get('ASAAS_WEBHOOK_SECRET') || '').trim();
  const ASAAS_ACCESS_TOKEN = (Deno.env.get('ASAAS_ACCESS_TOKEN') || '').trim();
  const ASAAS_BASE_URL =
    (Deno.env.get('ASAAS_BASE_URL') || 'https://www.asaas.com/api/v3').trim().replace(/\/+$/, '');
  const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();

  // 2 headers de auth obrigatórios:
  //   - 'asaas-access-token' enviado pelo Asaas no webhook (comparamos com ASAAS_WEBHOOK_SECRET)
  //   - service_role key + URL obrigatórios para escrever no banco
  if (!ASAAS_WEBHOOK_SECRET) {
    console.error('[FU WEBHOOK] ERRO FATAL: ASAAS_WEBHOOK_SECRET não definido nos secrets da Edge.');
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), {
      status: 500,
      headers: baseCors,
    });
  }
  if (!ASAAS_ACCESS_TOKEN) {
    console.error('[FU WEBHOOK] ERRO FATAL: ASAAS_ACCESS_TOKEN não definido nos secrets da Edge.');
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), {
      status: 500,
      headers: baseCors,
    });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[FU WEBHOOK] ERRO FATAL: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes.');
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), {
      status: 500,
      headers: baseCors,
    });
  }

  // =============== PASSO 1) Validar assinatura do webhook (header asaas-access-token) ===============
  const reqWebhookToken = (req.headers.get('asaas-access-token') || '').trim();

  const correlationId = `WH_FU_${Date.now()}`;

  if (!reqWebhookToken || reqWebhookToken !== ASAAS_WEBHOOK_SECRET) {
    console.groupCollapsed(`[FU WEBHOOK ${correlationId}] 401 Header asaas-access-token inválido`);
    console.warn('header recebido (masc):', maskKey(reqWebhookToken, 3, 2) || '(vazio)');
    console.warn('secret esperado (masc):', maskKey(ASAAS_WEBHOOK_SECRET, 3, 2));
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: baseCors,
    });
  }

  console.groupCollapsed(`[FU WEBHOOK ${correlationId}] Início do pipeline`);
  console.info('asaas-access-token (masc):', maskKey(reqWebhookToken));
  console.info('asaas api token (masc):', maskKey(ASAAS_ACCESS_TOKEN));
  console.info('supabase url:', SUPABASE_URL);
  console.info('asaas base url:', ASAAS_BASE_URL);

  // =============== PASSO 2) Parse do corpo do webhook + filtro de evento ===============
  let body: any = null;
  try {
    const rawText = await req.text();
    if (!rawText) throw new Error('body_vazio');
    body = JSON.parse(rawText);
  } catch (e: any) {
    console.warn(`[FU WEBHOOK ${correlationId}] Body inválido (não-JSON):`, e?.message);
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'bad_body' }), {
      status: 400,
      headers: baseCors,
    });
  }

  // Evento pode vir em body.event ou body.eventType (dependendo da config do webhook Asaas)
  const evento = String(body?.event || body?.eventType || '').trim();
  const pagamentoPayload = body?.payment ?? body?.data ?? body ?? null;

  const EVENTOS_PERMITIDOS = new Set([
    'PAYMENT_RECEIVED',
    'PAYMENT_CONFIRMED',
  ]);

  if (!EVENTOS_PERMITIDOS.has(evento.toUpperCase())) {
    console.warn(
      `[FU WEBHOOK ${correlationId}] Evento ignorado: "${evento}". Apenas PAYMENT_RECEIVED / PAYMENT_CONFIRMED são processados.`,
    );
    console.groupEnd();
    return new Response(JSON.stringify({ ok: true, processed: false, ignored_event: evento }), {
      status: 200,
      headers: baseCors,
    });
  }

  console.info('evento recebido:', evento);
  console.info('pagamento (resumo):', {
    id: pagamentoPayload?.id,
    externalReference: pagamentoPayload?.externalReference,
    billingType: pagamentoPayload?.billingType,
    value: pagamentoPayload?.value,
    status: pagamentoPayload?.status,
  });

  if (pagamentoPayload?.billingType && String(pagamentoPayload.billingType).toUpperCase() !== 'PIX') {
    console.warn(
      `[FU WEBHOOK ${correlationId}] billingType !== PIX (recebido ${pagamentoPayload.billingType}). Ignorado.`,
    );
    console.groupEnd();
    return new Response(JSON.stringify({ ok: true, processed: false, ignored_billing: pagamentoPayload.billingType }), {
      status: 200,
      headers: baseCors,
    });
  }

  if (String(pagamentoPayload?.status || '').toUpperCase() !== 'RECEIVED' &&
      String(pagamentoPayload?.status || '').toUpperCase() !== 'CONFIRMED') {
    console.warn(
      `[FU WEBHOOK ${correlationId}] status !== RECEIVED. status=${pagamentoPayload?.status}. Ignorado.`,
    );
    console.groupEnd();
    return new Response(JSON.stringify({ ok: true, processed: false, ignored_status: pagamentoPayload?.status }), {
      status: 200,
      headers: baseCors,
    });
  }

  const externalReference = String(pagamentoPayload?.externalReference || '').trim();
  const paymentId = String(pagamentoPayload?.id || '').trim();
  const valorCentavos = Number(pagamentoPayload?.value ?? pagamentoPayload?.netValue ?? 0);

  if (!externalReference) {
    console.warn(`[FU WEBHOOK ${correlationId}] externalReference vazio. Ignorado.`);
    console.groupEnd();
    return new Response(JSON.stringify({ ok: true, processed: false, ignored_no_ref: true }), {
      status: 200,
      headers: baseCors,
    });
  }

  if (!externalReference.toUpperCase().startsWith('FU_DINAMICO_')) {
    console.warn(
      `[FU WEBHOOK ${correlationId}] externalReference "${externalReference}" não começa com FU_DINAMICO_. Não é followup dinâmico. Ignorado.`,
    );
    console.groupEnd();
    return new Response(JSON.stringify({ ok: true, processed: false, ignored_not_fu: true }), {
      status: 200,
      headers: baseCors,
    });
  }

  // =============== PASSO 3) Extrair userId e planoId do externalReference =====================
  // Padrão: FU_DINAMICO_[USER_ID]_[TIMESTAMP]
  // PlanoId não está no externalReference para manter o ID curto; buscamos do storage payload
  // fallback a partir do VALOR da cobrança + sufixo.
  // Preferencialmente, usamos o valor recebido em centavos para inferir o plano.
  const partes = externalReference.split('_');
  const userId = (partes.slice(2, partes.length - 1).join('_') || '').trim();

  if (!userId) {
    console.error(
      `[FU WEBHOOK ${correlationId}] Não foi possível extrair userId de externalReference="${externalReference}".`,
    );
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'bad_external_ref' }), {
      status: 400,
      headers: baseCors,
    });
  }

  console.info('externalReference parse:', { externalReference, userId, paymentId, valorCentavos, valorReais: CENTAVOS_PARA_REAIS(valorCentavos) });

  // Inferir preço do plano pelo valor pago (rateio ≈ preço * diasRestantes/totalDias)
  // Para manter a simplicidade SEGURA: usamos os 3 preços fixos de plano e validamos que o
  // valor pago seja >= 0.2x o menor plano (garante que é uma cobrança válida mesmo rateada).
  const precoPlanoInferido =
    Object.entries(PLANOS_PRECOS).find(([_, preco]) => CENTAVOS_PARA_REAIS(valorCentavos) >= preco * 0.2)?.[1] ?? null;
  let planoIdInferido =
    Object.entries(PLANOS_PRECOS).find(([_, preco]) => preco === precoPlanoInferido)?.[0] || 'essencial';

  // Melhor tentativa: se pagamento tem 'description' com 'Plano XXXXX', captura.
  const desc = String(pagamentoPayload?.description || '').toLowerCase();
  const matchPlano = desc.match(/plano\s+(essencial|pro|empresarial)/);
  if (matchPlano?.[1]) planoIdInferido = matchPlano[1];

  const precoPlanoReais = PLANOS_PRECOS[planoIdInferido] ?? PLANOS_PRECOS.essencial;

  console.info('plano inferido:', {
    planoId: planoIdInferido,
    precoReais: precoPlanoReais,
    porDescricao: Boolean(matchPlano),
  });

  // =============== PASSO 4) Buscar dados ATUAIS de usuarios_v2 =============================
  console.info('Step 1/5 — Buscando dados atuais de usuarios_v2 ...');
  let userRow: any = null;
  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_v2?select=*&user_id=eq.${encodeURIComponent(userId)}&limit=1`, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
    });
    if (!resp.ok) throw new Error(`http_${resp.status}_${await resp.text().catch(() => '')}`);
    const arr = await resp.json();
    userRow = Array.isArray(arr) && arr.length ? arr[0] : null;
  } catch (e: any) {
    console.error(`[FU WEBHOOK ${correlationId}] Step 1/5 FALHOU ao buscar usuarios_v2:`, e?.message || e);
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'supabase_fetch_user' }), {
      status: 500,
      headers: baseCors,
    });
  }

  if (!userRow) {
    console.error(`[FU WEBHOOK ${correlationId}] Step 1/5 — usuário não encontrado. user_id=${userId}`);
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'user_not_found' }), {
      status: 404,
      headers: baseCors,
    });
  }

  const userValorMensalAtual = Number(userRow.user_valor_mensal ?? userRow.user_valor_mensal === 0 ? userRow.user_valor_mensal : 0) || 0;
  const followupDinamicoAtual = Boolean(userRow.followup_dinamico);
  const idClienteAsaas = String(userRow.id_cliente_asaas || '').trim();
  const idAssinaturaAsaas = String(userRow.id_assinatura_asaas || '').trim();

  console.info('Step 1/5 OK:', {
    user_valor_mensal_atual: userValorMensalAtual,
    followup_dinamico_atual: followupDinamicoAtual,
    id_cliente_asaas: maskKey(idClienteAsaas),
    id_assinatura_asaas: maskKey(idAssinaturaAsaas),
  });

  // =============== PASSO 5) GUARD CLAUSE anti dupla ativação ===============================
  if (followupDinamicoAtual === true) {
    console.warn(
      `[FU WEBHOOK ${correlationId}] !! WARN Step 2/5 GUARD CLAUSE: followup_dinamico já é TRUE.`,
    );
    console.warn('Saindo sem fazer NADA para evitar dupla ativação / dupla soma em user_valor_mensal.');
    console.groupEnd();
    return new Response(
      JSON.stringify({
        ok: true,
        processed: false,
        guard_clause: 'already_active',
        motivo: 'followup_dinamico já estava true.',
      }),
      { status: 200, headers: baseCors },
    );
  }

  // =============== PASSO 6) Calcular novoValorMensal =======================================
  const novoValorMensalReais = Number((userValorMensalAtual + precoPlanoReais).toFixed(2));
  const novoValorMensalCentavos = REAIS_PARA_CENTAVOS(novoValorMensalReais);

  console.info('Step 2/5 Cálculo novo valor mensal:', {
    userValorMensalAtual,
    precoPlanoReais,
    novoValorMensalReais,
    novoValorMensalCentavos,
  });

  // =============== PASSO 7) UPDATE usuarios_v2 (Atômico parte 1: primeiro banco) ==========
  console.info('Step 3/5 — Atualizando usuarios_v2 ...');
  try {
    const updatePayload = {
      user_valor_mensal: novoValorMensalReais,
      followup_dinamico: true,
      followup_dinamico_volume:
        userRow.followup_dinamico_volume != null
          ? userRow.followup_dinamico_volume
          : planoIdInferido === 'empresarial'
            ? 5000
            : planoIdInferido === 'pro'
              ? 1500
              : 500,
    };
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios_v2?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updatePayload),
      },
    );
    if (!resp.ok) throw new Error(`http_${resp.status}_${await resp.text().catch(() => '')}`);
    const respData = await resp.json().catch(() => null);
    console.info('Step 3/5 OK — usuarios_v2 atualizado:', {
      rows: Array.isArray(respData) ? respData.length : 0,
      payload: updatePayload,
    });
  } catch (e: any) {
    console.error(`[FU WEBHOOK ${correlationId}] Step 3/5 FALHOU update usuarios_v2:`, e?.message || e);
    console.groupEnd();
    return new Response(JSON.stringify({ ok: false, error: 'supabase_update_user' }), {
      status: 500,
      headers: baseCors,
    });
  }

  // =============== PASSO 8) DELETAR cobranças FUTURAS PENDENTES da assinatura Asaas =======
  console.info('Step 4/5 — Buscando cobranças futuras pendentes da assinatura ...');
  if (!idAssinaturaAsaas) {
    console.warn(
      `[FU WEBHOOK ${correlationId}] Step 4/5 id_assinatura_asaas ausente no cadastro. Pulando deleção de cobranças futuras (NÃO FATAL).`,
    );
  } else {
    try {
      const listResp = await fetch(
        `${ASAAS_BASE_URL}/subscriptions/${encodeURIComponent(idAssinaturaAsaas)}/payments?status=PENDING&expectedPaymentDateGreaterThan=${encodeURIComponent(hojeIso(0))}`,
        {
          method: 'GET',
          headers: {
            access_token: ASAAS_ACCESS_TOKEN,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
      if (!listResp.ok) throw new Error(`http_list_${listResp.status}_${await listResp.text().catch(() => '')}`);
      const listData: any = await listResp.json().catch(() => ({}));
      const cobrancas: any[] = Array.isArray(listData?.data) ? listData.data : [];
      console.info(`Step 4/5 — ${cobrancas.length} cobranças pendentes encontradas.`);

      for (const cob of cobrancas) {
        const cobId = String(cob.id || '').trim();
        try {
          const delResp = await fetch(`${ASAAS_BASE_URL}/payments/${encodeURIComponent(cobId)}`, {
            method: 'DELETE',
            headers: {
              access_token: ASAAS_ACCESS_TOKEN,
              Accept: 'application/json',
            },
          });
          if (!delResp.ok) throw new Error(`http_del_${delResp.status}_${await delResp.text().catch(() => '')}`);
          console.info(`Step 4/5 - delete OK payment_id=${cobId}`);
        } catch (e: any) {
          console.warn(
            `[FU WEBHOOK ${correlationId}] Step 4/5 WARN: não foi possível deletar cobrança ${cobId}. Erro: ${e?.message}. Continua pipeline (NÃO FATAL).`,
          );
        }
      }
    } catch (e: any) {
      console.warn(
        `[FU WEBHOOK ${correlationId}] Step 4/5 WARN geral em deleção cobranças futuras: ${e?.message}. Não aborta o pipeline.`,
      );
    }
  }

  // =============== PASSO 9) PATCH valor da assinatura Asaas ================================
  console.info('Step 5/5 — Atualizando valor da assinatura Asaas ...');
  if (!idAssinaturaAsaas) {
    console.warn(
      `[FU WEBHOOK ${correlationId}] Step 5/5 id_assinatura_asaas ausente. Pulando PATCH assinatura (NÃO FATAL, mas precisa ser ajustado manualmente).`,
    );
  } else {
    try {
      const patchResp = await fetch(
        `${ASAAS_BASE_URL}/subscriptions/${encodeURIComponent(idAssinaturaAsaas)}`,
        {
          method: 'PATCH',
          headers: {
            access_token: ASAAS_ACCESS_TOKEN,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            value: novoValorMensalReais,
            // O Asaas espera value em reais, não centavos. Vide doc oficial do Asaas PATCH /subscriptions/{id}.
          }),
        },
      );
      if (!patchResp.ok) throw new Error(`http_patch_${patchResp.status}_${await patchResp.text().catch(() => '')}`);
      const patchData = await patchResp.json().catch(() => null);
      console.info('Step 5/5 OK — assinatura atualizada no Asaas:', {
        subscription_id: maskKey(idAssinaturaAsaas),
        novo_valor: patchData?.value ?? novoValorMensalReais,
        // observação: alguns ambientes do Asaas usam PATCH, outros PUT. Se PATCH falhar, trocar por PUT.
      });
    } catch (e: any) {
      console.error(
        `[FU WEBHOOK ${correlationId}] Step 5/5 ERRO (NÃO FATAL se banco já estiver salvo): falha ao atualizar assinatura Asaas -> ${e?.message}. Corrigir manualmente se necessário.`,
      );
    }
  }

  const totalMs = Date.now() - startedAt;
  console.info(`Pipeline concluído em ${totalMs}ms.`);
  console.info('Resumo final:', {
    paymentId,
    userId,
    externalReference,
    valorPagoReais: CENTAVOS_PARA_REAIS(valorCentavos),
    plano: { id: planoIdInferido, mensalidade: precoPlanoReais },
    novoValorMensalReais,
  });
  console.groupEnd();

  return new Response(
    JSON.stringify({
      ok: true,
      processed: true,
      correlationId,
      totalMs,
      resultado: {
        user_id: userId,
        user_valor_mensal_de: userValorMensalAtual,
        user_valor_mensal_para: novoValorMensalReais,
        followup_dinamico: true,
        plano_id: planoIdInferido,
        novo_valor_assinatura_asaas_centavos: novoValorMensalCentavos,
      },
    }),
    { status: 200, headers: baseCors },
  );
});
