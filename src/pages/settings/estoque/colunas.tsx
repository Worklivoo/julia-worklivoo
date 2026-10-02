import React from 'react';
import { ExternalLink } from 'lucide-react';
import {
  sanitizeLink,
  toCellText,
  toTitleText,
  type EstoqueItem,
  type EstoqueKind,
  type ProdutoCarro,
  type ProdutoImobiliaria,
} from './helpers';

export type Coluna = {
  label: string;
  /** Texto exibido na célula. */
  texto?: (p: EstoqueItem) => React.ReactNode;
  /** Tooltip (title) da célula. */
  title?: (p: EstoqueItem) => string | undefined;
  /** Link do anúncio (a célula vira "Abrir"). */
  link?: (p: EstoqueItem) => string;
};

const c = (p: EstoqueItem) => p as ProdutoCarro;
const i = (p: EstoqueItem) => p as ProdutoImobiliaria;
const num = (v: unknown) => String(v ?? '-') || '-';

const carro: Coluna[] = [
  { label: 'Marca', texto: (p) => c(p).marca || '-', title: (p) => c(p).marca ?? undefined },
  { label: 'Modelo', texto: (p) => c(p).modelo || '-', title: (p) => c(p).modelo ?? undefined },
  { label: 'Ano', texto: (p) => c(p).ano_modelo || '-' },
  { label: 'KM', texto: (p) => c(p).quilometragem || '-' },
  { label: 'Portas', texto: (p) => c(p).portas || '-' },
  { label: 'Combustível', texto: (p) => c(p).combustivel || '-' },
  { label: 'Transmissão', texto: (p) => c(p).transmissao || '-' },
  { label: 'Cor', texto: (p) => c(p).cor || '-' },
  { label: 'Preço', texto: (p) => c(p).preco || '-' },
  { label: 'Descrição', texto: (p) => toCellText(c(p).descricao), title: (p) => toTitleText(c(p).descricao) },
  { label: 'Link', link: (p) => sanitizeLink(c(p).link_do_carro) },
];

const imovel: Coluna[] = [
  { label: 'Título', texto: (p) => toCellText(i(p).imovel_titulo), title: (p) => toTitleText(i(p).imovel_titulo) },
  { label: 'Transação', texto: (p) => i(p).imovel_transacao || '-' },
  { label: 'Propriedade', texto: (p) => i(p).imovel_propriedade || '-' },
  { label: 'Endereço', texto: (p) => toCellText(i(p).imovel_endereco), title: (p) => toTitleText(i(p).imovel_endereco) },
  { label: 'Valor venda', texto: (p) => num(i(p).imovel_valor_venda) },
  { label: 'Valor aluguel', texto: (p) => num(i(p).imovel_valor_aluguel) },
  { label: 'Área', texto: (p) => num(i(p).imovel_area) },
  { label: 'Condomínio', texto: (p) => num(i(p).imovel_valor_condominio) },
  { label: 'IPTU', texto: (p) => num(i(p).imovel_valor_iptu) },
  { label: 'Quartos', texto: (p) => num(i(p).imovel_quartos) },
  { label: 'Banheiros', texto: (p) => num(i(p).imovel_banheiros) },
  { label: 'Vagas', texto: (p) => num(i(p).imovel_vagas_garagem) },
  { label: 'Descrição', texto: (p) => toCellText(i(p).imovel_descricao), title: (p) => toTitleText(i(p).imovel_descricao) },
  { label: 'Link', link: (p) => sanitizeLink(i(p).imovel_link) },
];

/** Colunas da tabela de estoque de cada tipo. */
export const colunasDe = (kind: EstoqueKind): Coluna[] => (kind === 'carro' ? carro : imovel);

/** A coluna tem informação nesta linha? ("-" e vazio contam como sem informação) */
export const temValor = (col: Coluna, p: EstoqueItem): boolean => {
  if (col.link) return Boolean(col.link(p));
  const texto = String(col.texto?.(p) ?? '').trim();
  return texto !== '' && texto !== '-';
};

/** Mantém só as colunas que têm informação em pelo menos uma linha (com a lista vazia, mostra todas). */
export const colunasComDados = (colunas: Coluna[], itens: EstoqueItem[]): Coluna[] =>
  itens.length === 0 ? colunas : colunas.filter((col) => itens.some((p) => temValor(col, p)));

/** Célula de link: "Abrir" quando há link do anúncio, "-" quando não há. */
export const CelulaLink = ({ href }: { href: string }) =>
  href ? (
    <a href={href} target="_blank" rel="noreferrer" className="wl-textlink">
      Abrir <ExternalLink aria-hidden="true" width={14} height={14} />
    </a>
  ) : (
    <>-</>
  );
