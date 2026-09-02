// ============================================================
// Edge Function: poll-pagamento-fu-dinamico
// CHAMADA PELO FRONTEND a cada 3s enquanto o usuário aguarda o pagamento PIX.
//
// Objetivo: consultar status de uma cobrança sem expor o ASAAS_ACCESS_TOKEN
// no navegador. Retorna apenas o necessário (status, updatedAt).
//
// Segurança:
//   - Valida JWT do usuário e só permite consultar externalReferences que batam
//     com seu userId (padrão FU_DINAMICO_[USER_ID]_*).
//   - Nunca retorna dados sensíveis do Asaas.
// ============================================================

// Declaração global de compatibilidade Deno (resolve TS diagnostics do projeto principal)
// @ts-ignore - global Deno existe em runtime Supabase Edge Functions / Deno
declare global { const Deno: any; }
// @ts-ignore - Request é global em Deno
type RequestType = any;

// @ts-ignore - URL imports Deno não são resolvíveis fora do runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

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

const STATUS_MAP = new Set([
  'PENDING', 'RECEIVED', 'CONFIRMED', 'CANCELLED', 'EXPIRED', 'REFUNDED', 'FAILED',
]);

const normalizarStatus = (s: string): string => {
  const u = String(s || '').toUpperCase().trim();
  if (u === 'CONFIRMED' || u === 'RECEIVED') return 'RECEIVED';
  if (u === 'OVERDUE' || u === 'EXPIRED') return 'EXPIRED';
  if (u === 'DELETED' || u === 'CANCELLED') return 'CANCELLED';
  if (STATUS_MAP.has(u)) return u;
  return 'PENDING';
};

serve(async (req: RequestType) => {
  const baseCors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { status: 204, headers: baseCors });

  const ASAAS_ACCESS_TOKEN = (Deno.env.get('ASAAS_ACCESS_TOKEN') || '').trim();
  const ASAAS_BASE_URL =
    (Deno.env.get('ASAAS_BASE_URL') || 'https://www.asaas.com/api/v3').trim().replace(/\/+$/, '');

  if (!ASAAS_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_config' }), {
      status: 500, headers: baseCors,
    });
  }

  // 1. Valida sessão
  const authBearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const apikey = (req.headers.get('apikey') || '').trim();
  const jwt = authBearer || apikey;
  const claims = jwt ? decodeSupabaseJwt(jwt) : null;
  const callingUserId = String(claims?.sub || '').trim();
  if (!callingUserId) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401, headers: baseCors,
    });
  }

  // 2. Parse body
  let body: any = null;
  try { body = await req.json(); } catch { body = {}; }
  const paymentId = String(body?.paymentId || '').trim();
  const externalReference = String(body?.externalReference || '').trim();

  if (!paymentId && !externalReference) {
    return new Response(JSON.stringify({ ok: false, error: 'campos_requeridos', campos: ['paymentId', 'externalReference'] }), {
      status: 400, headers: baseCors,
    });
  }

  // 3. Segurança: externalReference deve começar com FU_DINAMICO_[callingUserId]
  // Garante que o usuário A não consulte pagamento do usuário B.
  if (externalReference) {
    const prefixoEsperado = `FU_DINAMICO_${callingUserId}_`;
    if (!externalReference.startsWith(prefixoEsperado)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'external_ref_usuario_incompativel',
          detalhe: 'Essa externalReference não pertence ao seu usuário.',
        }),
        { status: 403, headers: baseCors },
      );
    }
  }

  // 4. Consulta Asaas
  try {
    const searchParams = new URLSearchParams();
    if (paymentId) searchParams.set('id', paymentId);
    if (externalReference) searchParams.set('externalReference', externalReference);

    let finalUrl = `${ASAAS_BASE_URL}/payments`;
    if (paymentId) finalUrl = `${ASAAS_BASE_URL}/payments/${encodeURIComponent(paymentId)}`;
    else finalUrl = `${ASAAS_BASE_URL}/payments?${searchParams.toString()}&limit=1`;

    const resp = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        access_token: ASAAS_ACCESS_TOKEN,
        Accept: 'application/json',
      },
    });
    if (!resp.ok) throw new Error(`http_${resp.status}_${await resp.text().catch(() => '')}`);
    const d = await resp.json();

    let row: any = d;
    if (Array.isArray(d?.data) && d.data.length) row = d.data[0];
    else if (Array.isArray(d) && d.length) row = d[0];

    if (!row || !row.id) {
      return new Response(JSON.stringify({ ok: true, status: 'PENDING', payment_id: paymentId, encontrado: false }), {
        status: 200, headers: baseCors,
      });
    }

    // Se o usuário passou externalReference, valida que o paymentId encontrado bate com a mesma referência (redundância segura)
    if (externalReference && String(row.externalReference || '') !== externalReference) {
      console.warn(
        `[FU POLL] usuário ${callingUserId} tentou consultar pagamento de outra externalReference. Bloqueado.`,
      );
      return new Response(
        JSON.stringify({ ok: false, error: 'mismatch_external_ref' }),
        { status: 403, headers: baseCors },
      );
    }

    const statusRaw = String(row.status || 'PENDING');
    const status = normalizarStatus(statusRaw);

    return new Response(
      JSON.stringify({
        ok: true,
        status,
        statusAsaas: statusRaw,
        paymentId: row.id,
        externalReference: row.externalReference,
        updatedAt: row.updatedAt || row.confirmedDate || row.dateCreated || null,
        netValue: row.netValue || row.value || null,
      }),
      { status: 200, headers: baseCors },
    );
  } catch (e: any) {
    console.error(`[FU POLL user=${callingUserId}] Falha: ${e?.message || e}`);
    return new Response(
      JSON.stringify({ ok: false, error: 'asaas_poll_fail', detalhe: e?.message || String(e) }),
      { status: 502, headers: baseCors },
    );
  }
});
