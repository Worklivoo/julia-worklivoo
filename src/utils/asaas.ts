export const getAsaasApiKey = () => {
  let apiKey = import.meta.env.VITE_ASAAS_API_KEY;

  if (!apiKey) {
    console.error('ASAAS_API_KEY is missing');
    return null;
  }

  // Sanitização nuclear
  // Mantém apenas caracteres válidos para API Key do Asaas
  // Permite: Letras, Números, $, -, _, :, +, =, /
  const sanitized = apiKey.replace(/[^a-zA-Z0-9\-_\$:+=/]/g, '');

  // Debug detalhado (seguro)
  console.log('Asaas API Key Status:', {
    originalLength: apiKey.length,
    sanitizedLength: sanitized.length,
    isClean: apiKey === sanitized,
    firstChar: sanitized.charAt(0),
    lastChar: sanitized.charAt(sanitized.length - 1),
    // Mostra os códigos ASCII dos primeiros 5 chars para detectar caracteres invisíveis
    first5Ascii: sanitized.substring(0, 5).split('').map(c => c.charCodeAt(0)),
    hasDollarPrefix: sanitized.startsWith('$')
  });

  if (apiKey !== sanitized) {
    console.warn('⚠️ AVISO: A API Key continha caracteres inválidos que foram removidos.');
    console.warn('Caracteres removidos:', apiKey.length - sanitized.length);
  }

  return sanitized;
};

export const getAsaasUrl = (path: string) => {
  // Garante que o path comece com /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/asaas${cleanPath}`;
};
