export const getAsaasApiKey = () => {
  let apiKey = import.meta.env.VITE_ASAAS_API_KEY;

  if (!apiKey) {
    console.error('ASAAS_API_KEY is missing');
    return null;
  }

  // Sanitização robusta
  apiKey = apiKey.trim();

  // Remove aspas iniciais e finais se houver
  if ((apiKey.startsWith('"') && apiKey.endsWith('"')) || (apiKey.startsWith("'") && apiKey.endsWith("'"))) {
    apiKey = apiKey.substring(1, apiKey.length - 1);
  }

  // Remove barra invertida de escape do $ inicial, se houver
  if (apiKey.startsWith('\\$')) {
    apiKey = apiKey.replace('\\$', '$');
  }

  // Debug (seguro)
  console.log('Asaas API Key loaded:', {
    length: apiKey.length,
    startsWithDollar: apiKey.startsWith('$'),
    preview: apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4)
  });

  return apiKey;
};

export const getAsaasUrl = (path: string) => {
  // Garante que o path comece com /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/asaas${cleanPath}`;
};
