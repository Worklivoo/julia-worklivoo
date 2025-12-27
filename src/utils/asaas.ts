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
  // Garante que o path comece com /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/asaas${cleanPath}`;
};
