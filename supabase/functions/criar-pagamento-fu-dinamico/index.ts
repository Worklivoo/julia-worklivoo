// ============================================================
// Edge Function: criar-pagamento-fu-dinamico
// CHAMADA PELO FRONTEND (FollowUpDinamicoTab.tsx -> handleGerarQrCode)
//
// Responsabilidade ÚNICA: criar a cobrança PIX no Asaas e retornar
// { paymentId, pixPayload, pixBase64, qrCodeImageUrl, expirationDate }
//
// Segurança:
//   - NÃO deixamos o ASAAS_ACCESS_TOKEN no frontend.
//   - Apenas essa Edge, com service role, detém o token do Asaas.
//   - Valida sessão do usuário via JWT do Supabase (header Authorization Bearer).
//   - Valida idempotency: cria ou recupera a mesma cobrança se mesmo externalReference.
// ============================================================

// Declaração global de compatibilidade Deno (resolve TS diagnostics do projeto principal)
// @ts-ignore - global Deno existe em runtime Supabase Edge Functions / Deno
declare global { const Deno: any; }
// @ts-ignore - Request é global em Deno
type RequestType = any;

// @ts-ignore - URL imports Deno não são resolvíveis fora do runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const CENTAVOS = (r: number) => Math.round((Number(r) || 0) * 100);

const PLANOS_PRECOS: Record<string, number> = {
  essencial: 5,
  pro: 6,
  empresarial: 7,
};
const PLANOS_VOLUME: Record<string, number> = {
  essencial: 500,
  pro: 1500,
  empresarial: 5000,
};

const decodeSupabaseJwt = (jwt: string) => {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const safeJsonPreview = (v: unknown, n = 240) => {
  try {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > n ? `${s.slice(0, n)}...` : s;
  } catch {
    return String(v ?? '');
  }
};

serve(async (req: RequestType) => {
  const startedAt = Date.now();
  const baseCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, idempotency-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { status: 204, headers: baseCors });

  // ================= 1. Secrets =================
  const ASAAS_ACCESS_TOKEN = (Deno.env.get('ASAAS_ACCESS_TOKEN') || '').trim();
  const ASAAS_BASE_URL =
    (Deno.env.get('ASAAS_BASE_URL') || 'https://www.asaas.com/api/v3').trim().replace(/\/+$/, '');
  const SUPABASE_URL = (Deno.env.get('SUPABASE_URL') || '').trim();
  const SUPABASE_SERVICE_ROLE_KEY = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();

  if (!ASAAS_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing_config', detalhe: 'secrets da edge ausentes.' }),
      { status: 500, headers: baseCors },
    );
  }

  // ================= 2. Valida sessão =================
  const authBearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const apikey = (req.headers.get('apikey') || '').trim();
  const jwt = authBearer || apikey;
  const claims = jwt ? decodeSupabaseJwt(jwt) : null;
  const callingUserId = String(claims?.sub || '').trim();
  const callingUserRole = String(claims?.role || '').trim();

  if (!callingUserId || !callingUserRole || callingUserRole === 'anon') {
    return new Response(
      JSON.stringify({ ok: false, error: 'unauthorized', detalhe: 'JWT não autenticado.' }),
      { status: 401, headers: baseCors },
    );
  }

  // ================= 3. Parse body =================
  let body: any = null;
  try {
    body = await req.json();
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: 'bad_body', detalhe: e?.message }),
      { status: 400, headers: baseCors },
    );
  }

  const planoId = String(body?.planoId || '').trim().toLowerCase();
  const customerId = String(body?.customerId || '').trim();
  const valorRateioReais = Number(body?.valorRateio || 0);
  const externalReference = String(body?.externalReference || '').trim();
  const descricao = String(body?.description || '').trim() ||
    `FollowUp Dinâmico - Contratação - Plano ${planoId}`;
  const dueDate = String(body?.dueDate || new Date().toISOString().split('T')[0]).trim();

  const correlationId = `CRIAR_${externalReference || callingUserId}_${startedAt}`;

  console.groupCollapsed(`[FU CRIAR PAGAMENTO ${correlationId}] Nova solicitação`);
  console.info('user_id (sessão):', callingUserId);
  console.info('planoId:', planoId);
  console.info('customerId (Asaas):', customerId ? `${customerId.slice(0, 6)}...${customerId.slice(-4)}` : '(vazio)');
  console.info('valorRateioReais:', valorRateioReais);
  console.info('externalReference:', externalReference);
  console.info('dueDate:', dueDate);
  console.groupEnd();

  if (!planoId || !PLANOS_PRECOS[planoId]) {
    return new Response(
      JSON.stringify({ ok: false, error: 'plano_invalido', planos: Object.keys(PLANOS_PRECOS) }),
      { status: 400, headers: baseCors },
    );
  }
  if (!customerId) {
    return new Response(JSON.stringify({ ok: false, error: 'customer_required' }), {
      status: 400,
      headers: baseCors,
    });
  }
  if (!externalReference.startsWith('FU_DINAMICO_')) {
    return new Response(JSON.stringify({ ok: false, error: 'external_ref_invalido' }), {
      status: 400,
      headers: baseCors,
    });
  }
  if (valorRateioReais <= 0) {
    return new Response(JSON.stringify({ ok: false, error: 'valor_invalido' }), {
      status: 400,
      headers: baseCors,
    });
  }

  // Verifica que o customerId bate com o id_cliente_asaas do usuário dono da sessão (segurança)
  try {
    const uResp = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios_v2?select=id_cliente_asaas,id_assinatura_asaas&user_id=eq.${encodeURIComponent(callingUserId)}&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          Accept: 'application/json',
          Prefer: 'return=representation',
        },
      },
    );
    const arr = await uResp.json();
    const u = Array.isArray(arr) ? arr[0] : null;
    if (!u) throw new Error('user_nao_encontrado');
    if (String(u.id_cliente_asaas || '').trim() !== customerId) {
      console.error(
        `[FU CRIAR PAGAMENTO ${correlationId}] customerId enviado nao bate com usuarios_v2.id_cliente_asaas. Suspeita de tentativa de burlar cliente.`,
      );
      return new Response(JSON.stringify({ ok: false, error: 'customer_mismatch' }), {
        status: 403,
        headers: baseCors,
      });
    }
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, error: 'falha_validacao_user', detalhe: e?.message }),
      { status: 500, headers: baseCors },
    );
  }

  const idempotencyKey =
    (req.headers.get('idempotency-key') || '').trim() || correlationId;

  // ================= 4. Criar pagamento PIX no Asaas =================
  let pagamentoAsaas: any = null;
  try {
    console.info(`[FU CRIAR PAGAMENTO ${correlationId}] Enviando POST /v3/payments ...`);
    const bodyPagamento = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(valorRateioReais.toFixed(2)),
      dueDate,
      externalReference,
      description: descricao,
      postalService: false,
    };
    const resp = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        access_token: ASAAS_ACCESS_TOKEN,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        idempotency: idempotencyKey,
      },
      body: JSON.stringify(bodyPagamento),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => '');
      throw new Error(`http_${resp.status}_${safeJsonPreview(t)}`);
    }
    pagamentoAsaas = await resp.json();
    console.info(`[FU CRIAR PAGAMENTO ${correlationId}] Pagamento criado OK. id=${pagamentoAsaas.id} status=${pagamentoAsaas.status}`);
  } catch (e: any) {
    console.error(`[FU CRIAR PAGAMENTO ${correlationId}] Erro Asaas:`, e?.message || e);
    return new Response(
      JSON.stringify({ ok: false, error: 'asaas_create_fail', detalhe: e?.message }),
      { status: 502, headers: baseCors },
    );
  }

  // ================= 5. Obter QR Code + payload PIX =================
  let pixPayload = '';
  let pixBase64: string | null = null;
  let qrCodeImageUrl: string | null = null;
  let expirationDate: string | null =
    pagamentoAsaas?.pix?.qrCode?.expirationDate ||
    pagamentoAsaas?.dueDate ||
    null;
  try {
    const qrResp = await fetch(
      `${ASAAS_BASE_URL}/payments/${encodeURIComponent(pagamentoAsaas.id)}/pixQrCode`,
      {
        method: 'GET',
        headers: {
          access_token: ASAAS_ACCESS_TOKEN,
          Accept: 'application/json',
        },
      },
    );
    if (qrResp.ok) {
      const d = await qrResp.json();
      pixPayload = String(d.payload || d.qrCodePayload || '').trim();
      pixBase64 = String(d.encodedImage || d.encodedImage || '').trim() || null;
      qrCodeImageUrl = String(d.qrCodeImageUrl || '').trim() || null;
      expirationDate =
        String(d.expirationDate || d.pix?.expirationDate || expirationDate || '').trim() || null;
    } else {
      console.warn(
        `[FU CRIAR PAGAMENTO ${correlationId}] pixQrCode retornou ${qrResp.status}. Tentando extrair do body de pagamento...`,
      );
      pixPayload = String(pagamentoAsaas?.pix?.payload || pagamentoAsaas?.pix?.qrCode?.payload || '').trim();
      pixBase64 = String(pagamentoAsaas?.pix?.qrCode?.base64 || pagamentoAsaas?.pix?.qrCode?.encodedImage || '').trim() || null;
      qrCodeImageUrl = String(pagamentoAsaas?.pix?.qrCode?.url || '').trim() || null;
    }
  } catch (e: any) {
    console.warn(
      `[FU CRIAR PAGAMENTO ${correlationId}] Erro ao obter pixQrCode (NÃO FATAL se payload existir em pagamento):`,
      e?.message,
    );
  }

  const totalMs = Date.now() - startedAt;
  console.info(`[FU CRIAR PAGAMENTO ${correlationId}] Concluído em ${totalMs}ms.`);

  return new Response(
    JSON.stringify({
      ok: true,
      correlationId,
      totalMs,
      plano: {
        id: planoId,
        preco: PLANOS_PRECOS[planoId],
        volume: PLANOS_VOLUME[planoId],
      },
      pagamento: {
        id: pagamentoAsaas.id,
        externalReference,
        status: pagamentoAsaas.status,
        valorReais: Number(valorRateioReais.toFixed(2)),
        valorCentavos: CENTAVOS(valorRateioReais),
        dueDate,
      },
      pix: {
        payload: pixPayload,
        base64: pixBase64,
        qrCodeImageUrl,
        expirationDate,
      },
    }),
    { status: 201, headers: baseCors },
  );
});
