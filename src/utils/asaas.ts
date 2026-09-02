const getAsaasProxyStrategy = () => {
  return String(import.meta.env.VITE_ASAAS_PROXY || '').trim().toLowerCase();
};

const getAsaasDebugEnabled = () => {
  return String(import.meta.env.VITE_DEBUG_ASAAS || '').trim().toLowerCase() === 'true';
};

const maskAsaasToken = (token: string) => {
  const t = String(token || '').trim();
  if (!t) return '';
  if (t.length <= 12) return `${t.slice(0, 2)}...${t.slice(-2)}`;
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
};

const safeJsonPreview = (text: string, maxLen = 220) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen)}...` : trimmed;
};

const getAsaasProxyBaseFromMeta = () => {
  if (typeof document === 'undefined') return '';
  const meta = document.querySelector('meta[name="asaas-proxy-base"]') as HTMLMetaElement | null;
  const content = String(meta?.content || '').trim();
  if (!content) return '';
  return content.endsWith('/') ? content.slice(0, -1) : content;
};

export const shouldRequireAsaasApiKey = () => {
  if (import.meta.env.DEV) return true;
  const proxyStrategy = getAsaasProxyStrategy();
  if (proxyStrategy === 'php') return false;
  if (proxyStrategy === 'api') return true;
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname.endsWith('.vercel.app')) return true;
  return false;
};

export const getAsaasApiKey = () => {
  const apiKey = import.meta.env.VITE_ASAAS_API_KEY;

  if (!apiKey) {
    if (shouldRequireAsaasApiKey()) {
      console.error('ASAAS_API_KEY is missing');
      if (import.meta.env.DEV) {
        console.error('[Asaas] Dica: se sua chave começa com "$", o Vite pode tentar expandir como variável do .env. Use \\$ no início ou coloque o valor entre aspas simples no .env.local e reinicie o dev server.');
      }
    }
    return null;
  }

  // Sanitização da API Key (Remove aspas simples ou duplas extras caso existam)
  const cleanApiKey = apiKey.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, '');

  // Retorna a API Key limpa
  if (getAsaasDebugEnabled()) {
    console.info('[Asaas] API key carregada:', maskAsaasToken(cleanApiKey));
  }
  return cleanApiKey;
};

export const getAsaasUrl = (path: string) => {
  // Em desenvolvimento (localhost), usa o proxy do Vite configurado no vite.config.ts
  if (import.meta.env.DEV) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/api/asaas${cleanPath}`;
  }

  const cleanPathWithSlash = path.startsWith('/') ? path : `/${path}`;
  const cleanPathWithoutSlash = cleanPathWithSlash.substring(1);

  const proxyStrategy = String(import.meta.env.VITE_ASAAS_PROXY || '').trim().toLowerCase();
  if (proxyStrategy === 'api') {
    return `/api/asaas${cleanPathWithSlash}`;
  }
  if (proxyStrategy === 'php') {
    return `/asaas-proxy.php?path=${encodeURIComponent(cleanPathWithoutSlash)}`;
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname.endsWith('.vercel.app')) {
    return `/api/asaas${cleanPathWithSlash}`;
  }

  return `/asaas-proxy.php?path=${encodeURIComponent(cleanPathWithoutSlash)}`;
};

const isJsonLikeText = (text: string) => {
  const trimmed = text.trimStart();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
};

const isHtmlOrPhpText = (text: string) => {
  const trimmed = text.trimStart();
  return trimmed.startsWith('<') || trimmed.startsWith('<?php');
};

const isJsonContentType = (contentType: string) => {
  const ct = contentType.toLowerCase();
  return ct.includes('application/json') || ct.includes('+json');
};

const withAsaasDebug = (init?: RequestInit) => {
  if (!getAsaasDebugEnabled()) return init;
  const headers = new Headers(init?.headers || {});
  headers.set('x-debug-asaas', '1');
  return { ...(init || {}), headers };
};

const hasHeader = (init: RequestInit | undefined, name: string) => {
  if (!init?.headers) return false;
  try {
    const headers = new Headers(init.headers as any);
    return headers.has(name);
  } catch {
    return false;
  }
};

export const asaasFetch = async (path: string, init?: RequestInit) => {
  const cleanPathWithSlash = path.startsWith('/') ? path : `/${path}`;
  const cleanPathWithoutSlash = cleanPathWithSlash.substring(1);

  if (import.meta.env.DEV) {
    if (getAsaasDebugEnabled()) {
      console.info('[Asaas] request(dev):', {
        method: init?.method || 'GET',
        url: `/api/asaas${cleanPathWithSlash}`,
        hasAccessToken: hasHeader(init, 'access_token'),
      });
    }
    return fetch(`/api/asaas${cleanPathWithSlash}`, withAsaasDebug(init));
  }

  const base = getAsaasProxyBaseFromMeta();
  const apiUrl = `${base}/api/asaas${cleanPathWithSlash}`;
  const phpUrl = `${base}/asaas-proxy.php?path=${encodeURIComponent(cleanPathWithoutSlash)}`;

  const proxyStrategy = getAsaasProxyStrategy();
  const urls =
    proxyStrategy === 'php' ? [phpUrl] :
    proxyStrategy === 'api' ? [apiUrl] :
    [apiUrl, phpUrl];

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const debug = getAsaasDebugEnabled();
  if (debug) {
    console.info('[Asaas] request(prod):', {
      method: init?.method || 'GET',
      path: cleanPathWithSlash,
      proxyStrategy,
      base: base || '(same-origin)',
      hostname,
      tries: urls,
      hasAccessToken: hasHeader(init, 'access_token'),
    });
  }

  let lastResponse: Response | null = null;
  for (const url of urls) {
    const startedAt = Date.now();
    const response = await fetch(url, withAsaasDebug(init));
    lastResponse = response;

    const contentType = response.headers.get('content-type') || '';
    if (debug) {
      console.info('[Asaas] response:', {
        url,
        status: response.status,
        ok: response.ok,
        contentType,
        ms: Date.now() - startedAt,
        requestId: response.headers.get('x-asaas-proxy-request-id') || response.headers.get('X-Asaas-Proxy-Request-Id'),
        tokenSource: response.headers.get('x-asaas-proxy-token-source') || response.headers.get('X-Asaas-Proxy-Token-Source'),
      });
    }
    if (isJsonContentType(contentType)) return response;

    const probeText = await response.clone().text().catch(() => '');
    if (isJsonLikeText(probeText)) return response;

    if (debug && probeText) {
      console.info('[Asaas] non-json preview:', safeJsonPreview(probeText));
    }

    if (response.ok && isHtmlOrPhpText(probeText)) {
      continue;
    }

    if (!response.ok && urls.length > 1) {
      continue;
    }

    return response;
  }

  return lastResponse as Response;
};
