export const getAsaasApiKey = () => {
  const apiKey = import.meta.env.VITE_ASAAS_API_KEY;

  if (!apiKey) {
    console.error('ASAAS_API_KEY is missing');
    return null;
  }

  // Retorna a API Key exatamente como está na variável de ambiente
  return apiKey;
};

export const getAsaasUrl = (path: string) => {
  // Garante que o path comece com /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/asaas${cleanPath}`;
};
