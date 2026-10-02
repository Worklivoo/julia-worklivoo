import { supabase } from '@/lib/supabase';

export type ProdutoCarro = {
  idx?: number | null;
  estoque_id?: number | null;
  marca?: string | null;
  modelo?: string | null;
  quilometragem?: string | null;
  ano_modelo?: string | null;
  portas?: string | null;
  combustivel?: string | null;
  transmissao?: string | null;
  cor?: string | null;
  preco?: string | null;
  descricao?: string | null;
  itens_extras?: string | null;
  link_do_carro?: string | null;
  user_id?: string | null;
  status_atualizacao?: string | null;
  atualizado_em?: string | null;
  uuid?: string | null;
};

export type ProdutoImobiliaria = {
  idx?: number | null;
  imovel_titulo?: string | null;
  imovel_transacao?: string | null;
  imovel_propriedade?: string | null;
  imovel_descricao?: string | null;
  imovel_endereco?: string | null;
  imovel_link?: string | null;
  imovel_valor_venda?: string | number | null;
  imovel_valor_aluguel?: string | number | null;
  imovel_area?: string | number | null;
  imovel_valor_condominio?: string | number | null;
  imovel_valor_iptu?: string | number | null;
  imovel_quartos?: number | null;
  imovel_banheiros?: number | null;
  imovel_vagas_garagem?: number | null;
  imovel_caracteristicas?: string | null;
  itens_extras?: string | null;
  created_at?: string | null;
  atualizado_em?: string | null;
  imovel_id?: number | null;
  user_id?: string | null;
  uuid?: string | null;
};

export type EstoqueKind = 'carro' | 'imovel';
export type EstoqueItem = ProdutoCarro | ProdutoImobiliaria;

export const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR');
};

export const sanitizeLink = (value: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const noWrapTicks = raw.replace(/^\s*`+/, '').replace(/`+\s*$/, '').trim();
  return noWrapTicks;
};

export const toCellText = (value: unknown) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') {
    const v = value.trim();
    return v ? v : '-';
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const asJson = JSON.stringify(value);
    return asJson && asJson !== '{}' ? asJson : '-';
  } catch {
    return String(value);
  }
};

export const toTitleText = (value: unknown) => {
  const text = toCellText(value);
  return text === '-' ? undefined : text;
};

export const generateRandomInt8 = () => {
  const min = 1n;
  const max = 9223372036854775807n;
  const range = max - min + 1n;
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  let randomBigInt = 0n;
  for (let i = 0; i < 8; i++) {
    randomBigInt = (randomBigInt << 8n) | BigInt(randomBytes[i]);
  }
  const result = min + (randomBigInt % range);
  return Number(result);
};

export const generateUniqueInt8Id = async (
  table: 'produto_carro_v2' | 'produto_imobiliaria_v2',
  idColumn: 'estoque_id' | 'imovel_id'
): Promise<number> => {
  let attempts = 0;
  const maxAttempts = 20;
  while (attempts < maxAttempts) {
    const candidate = generateRandomInt8();
    const { data, error } = await supabase
      .from(table)
      .select(idColumn)
      .eq(idColumn, candidate)
      .maybeSingle();
    if (!error && !data) {
      return candidate;
    }
    attempts++;
  }
  const fallback = Math.floor(Date.now() * 1000 + Math.random() * 1000000);
  return fallback;
};

export const formatCurrencyDisplay = (value: unknown): string => {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (!raw) return '';
  const numeric = Number(raw) / 100;
  return numeric.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
};

export const formatThousandsDisplay = (value: unknown): string => {
  const raw = String(value ?? '').replace(/\D/g, '');
  if (!raw) return '';
  return Number(raw).toLocaleString('pt-BR');
};

export const toPureNumberString = (value: unknown): string => {
  return String(value ?? '').replace(/\D/g, '');
};
