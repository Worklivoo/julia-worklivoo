/** Só os dígitos do telefone. */
export const normalizePhone = (value: string) => value.replace(/\D/g, '');

/** Dígitos do telefone sem o 55 inicial e limitados a DDD + 9 dígitos. */
export const normalizeAddMemberPhone = (value: string) => {
  const digits = normalizePhone(value);
  const withoutCountryCode = digits.startsWith('55') ? digits.slice(2) : digits;
  return withoutCountryCode.slice(0, 11);
};

/** Máscara (12) 99598-9598 aplicada enquanto o usuário digita. */
export const formatAddMemberPhone = (value: string) => {
  const digits = normalizeAddMemberPhone(value);
  const ddd = digits.slice(0, 2);
  const number = digits.slice(2);
  const firstPartLength = number.length > 8 ? 5 : 4;
  const firstPart = number.slice(0, firstPartLength);
  const secondPart = number.slice(firstPartLength, firstPartLength + 4);

  let formatted = '';

  if (ddd.length > 0) {
    formatted += `(${ddd}`;
    if (ddd.length === 2) {
      formatted += ')';
    }
  }

  if (firstPart.length > 0) {
    formatted += ddd.length === 2 ? ` ${firstPart}` : firstPart;
  }

  if (secondPart.length > 0) {
    formatted += `-${secondPart}`;
  }

  return formatted;
};

export const getInitials = (nome: string) =>
  nome
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
