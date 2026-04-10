export const getAsaasApiKey = () => {
  const apiKey = import.meta.env.VITE_ASAAS_API_KEY;

  if (!apiKey) {
    console.error('ASAAS_API_KEY is missing');
    return null;
  }

  // Sanitização da API Key (Remove aspas simples ou duplas extras caso existam)
  const cleanApiKey = apiKey.trim().replace(/^['"]|['"]$/g, '');

  // Retorna a API Key limpa
  return cleanApiKey;
};

export const getAsaasUrl = (path: string) => {
  // Em desenvolvimento (localhost), usa o proxy do Vite configurado no vite.config.ts
  if (import.meta.env.DEV) {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/api/asaas${cleanPath}`;
  }

  // Em produção (HostGator/cPanel), usa o proxy PHP
  // Isso contorna o problema de CORS e a falta de proxy reverso no Apache compartilhado
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  
  // Codifica o path para passar como parâmetro query string seguro
  return `/asaas-proxy.php?path=${encodeURIComponent(cleanPath)}`;
};
