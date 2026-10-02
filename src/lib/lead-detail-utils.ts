

/**
 * Formata o telefone para o padrão +55 99 99999-9999
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  let rest = digits.startsWith('55') ? digits.slice(2) : digits;
  const area = rest.slice(0, 2);
  const number = rest.slice(2);
  if (!area || !number) return phone;
  if (number.length >= 9) {
    return `+55 ${area} ${number.slice(0, 5)}-${number.slice(5, 9)}`;
  }
  if (number.length >= 8) {
    return `+55 ${area} ${number.slice(0, 4)}-${number.slice(4, 8)}`;
  }
  return `+55 ${area} ${number}`;
}
