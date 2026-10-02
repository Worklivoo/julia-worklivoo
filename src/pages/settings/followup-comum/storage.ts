import type { FollowUpPagamento } from './types';
import type { FollowUpKind } from './kinds';

const STORAGE_EXPIRE_MS = 24 * 60 * 60 * 1000; // 24h

/** Guarda no localStorage a cobrança PIX em andamento, para retomar se a página recarregar. */
export const createPagamentoStorage = (kind: FollowUpKind) => {
  const STORAGE_PREFIX = kind.storagePrefix;
  const DEBUG_TAG = `${kind.logTag} Storage`;

  const getStorageKey = (userId: string | null | undefined): string | null => {
    if (!userId) return null;
    return `${STORAGE_PREFIX}${String(userId)}`;
  };

  const savePagamentoToStorage = (
    userId: string | null | undefined,
    data: FollowUpPagamento,
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
  ): FollowUpPagamento | null => {
    const key = getStorageKey(userId);
    if (!key) return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        console.debug(`[${DEBUG_TAG}] load -> key=${key}; payload=VAZIO`);
        return null;
      }
      const parsed = JSON.parse(raw) as FollowUpPagamento;
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
      } catch {
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

  return {
    save: savePagamentoToStorage,
    load: loadPagamentoFromStorage,
    clear: clearPagamentoFromStorage,
  };
};

export type PagamentoStorage = ReturnType<typeof createPagamentoStorage>;
