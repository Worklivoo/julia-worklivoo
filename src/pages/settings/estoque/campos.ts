import {
  formatCurrencyDisplay,
  formatThousandsDisplay,
  toPureNumberString,
  type EstoqueKind,
} from './helpers';

export type CampoTipo = 'text' | 'currency' | 'thousands' | 'int' | 'textarea';

export type Campo = {
  key: string;
  label: string;
  placeholder: string;
  tipo: CampoTipo;
  /** Ocupa as duas colunas do formulário. */
  largo?: boolean;
  /** Altura mínima (só para textarea). */
  altura?: number;
  /** Campos pequenos que ficam lado a lado numa linha de três. */
  trio?: boolean;
};

const carro: Campo[] = [
  { key: 'marca', label: 'Marca', placeholder: 'Ex: NISSAN', tipo: 'text' },
  { key: 'modelo', label: 'Modelo', placeholder: 'Ex: KICKS 1.6 16V FLEXSTART', tipo: 'text' },
  { key: 'ano_modelo', label: 'Ano / Modelo', placeholder: 'Ex: 2019/2020', tipo: 'text' },
  { key: 'quilometragem', label: 'Quilometragem', placeholder: 'Ex: 101.000', tipo: 'thousands' },
  { key: 'portas', label: 'Portas', placeholder: 'Ex: 4', tipo: 'int' },
  { key: 'cor', label: 'Cor', placeholder: 'Ex: Prata', tipo: 'text' },
  { key: 'combustivel', label: 'Combustível', placeholder: 'Ex: Flex', tipo: 'text' },
  { key: 'transmissao', label: 'Transmissão', placeholder: 'Ex: Automático', tipo: 'text' },
  { key: 'preco', label: 'Preço', placeholder: 'R$ 0,00', tipo: 'currency', largo: true },
  { key: 'link_do_carro', label: 'Link do Anúncio', placeholder: 'https://...', tipo: 'text', largo: true },
  {
    key: 'descricao',
    label: 'Descrição',
    placeholder: 'Itens de série, características, observações...',
    tipo: 'textarea',
    largo: true,
    altura: 100,
  },
];

const imovel: Campo[] = [
  { key: 'imovel_titulo', label: 'Título do Imóvel', placeholder: 'Ex: Apartamento 2 quartos no centro', tipo: 'text', largo: true },
  { key: 'imovel_transacao', label: 'Transação', placeholder: 'Ex: Venda / Aluguel', tipo: 'text' },
  { key: 'imovel_propriedade', label: 'Tipo de Propriedade', placeholder: 'Ex: Apartamento, Casa, Terreno', tipo: 'text' },
  { key: 'imovel_endereco', label: 'Endereço', placeholder: 'Rua, número, bairro, cidade', tipo: 'text', largo: true },
  { key: 'imovel_valor_venda', label: 'Valor de Venda', placeholder: 'R$ 0,00', tipo: 'currency' },
  { key: 'imovel_valor_aluguel', label: 'Valor de Aluguel', placeholder: 'R$ 0,00', tipo: 'currency' },
  { key: 'imovel_area', label: 'Área (m²)', placeholder: 'Ex: 85', tipo: 'thousands' },
  { key: 'imovel_valor_condominio', label: 'Valor Condomínio', placeholder: 'R$ 0,00', tipo: 'currency' },
  { key: 'imovel_valor_iptu', label: 'Valor IPTU', placeholder: 'R$ 0,00', tipo: 'currency' },
  { key: 'imovel_quartos', label: 'Quartos', placeholder: '0', tipo: 'int', trio: true },
  { key: 'imovel_banheiros', label: 'Banheiros', placeholder: '0', tipo: 'int', trio: true },
  { key: 'imovel_vagas_garagem', label: 'Vagas Garagem', placeholder: '0', tipo: 'int', trio: true },
  { key: 'imovel_link', label: 'Link do Anúncio', placeholder: 'https://...', tipo: 'text', largo: true },
  {
    key: 'imovel_descricao',
    label: 'Descrição',
    placeholder: 'Descrição detalhada do imóvel...',
    tipo: 'textarea',
    largo: true,
    altura: 100,
  },
  {
    key: 'imovel_caracteristicas',
    label: 'Características',
    placeholder: 'Churrasqueira, piscina, elevador, etc...',
    tipo: 'textarea',
    largo: true,
    altura: 80,
  },
];

/** Campos do formulário de cadastro/edição de cada tipo de estoque. */
export const camposDe = (kind: EstoqueKind): Campo[] => (kind === 'carro' ? carro : imovel);

/** Valor mostrado no campo (com máscara de moeda ou milhar quando for o caso). */
export const valorExibido = (campo: Campo, valor: unknown): string => {
  if (campo.tipo === 'currency') return formatCurrencyDisplay(valor);
  if (campo.tipo === 'thousands') return formatThousandsDisplay(valor);
  return String(valor ?? '');
};

/** Valor que vai para o estado ao digitar (aplica a máscara ou deixa só números). */
export const valorDigitado = (campo: Campo, texto: string): string => {
  if (campo.tipo === 'currency') return formatCurrencyDisplay(texto);
  if (campo.tipo === 'thousands') return formatThousandsDisplay(texto);
  if (campo.tipo === 'int') return toPureNumberString(texto);
  return texto;
};
