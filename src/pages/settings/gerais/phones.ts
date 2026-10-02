/** Máscara "(11) 99999-9999" e conversões para guardar/ler telefones em Configurações. */
export const formatPhoneInput = (value: string) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }

  let formatted = digits;
  if (digits.length > 2) {
    formatted = `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
  }
  if (digits.length > 7) {
    formatted = `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7, 11)}`;
  }

  return formatted;
};
export const normalizePhoneForStorage = (value: string) => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length > 11) {
    digits = digits.substring(2);
  }

  return digits.length >= 10 ? `55${digits}` : '';
};
export const parseStoredPhones = (value: string | null) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((phone) => formatPhoneInput(phone));

/** Máscara usada nos campos de "Distribuição de Leads" (limita a 11 dígitos, sem tirar o 55). */
export const formatPhoneInline = (value: string) => {
  const val = value.replace(/D/g, '');
  let formatted = val;
  if (val.length > 2) {
    formatted = `(${val.substring(0, 2)}) ${val.substring(2)}`;
  }
  if (val.length > 7) {
    formatted = `(${val.substring(0, 2)}) ${val.substring(2, 7)}-${val.substring(7, 11)}`;
  }
  return formatted;
};
