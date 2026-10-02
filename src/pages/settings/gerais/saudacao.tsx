import React from 'react';

/** Modelos de mensagem de saudação (Loja de Carros e Imobiliária) e destaque das variáveis no texto. */
const saudacaoModelosLojaDeCarros = [
  {
    id: 'mensagem_saudacao_padrao_1',
    titulo: 'Modelo 1',
    texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro, e estou entrando em contato para fazer o seu primeiro atendimento.

Você tem alguma dúvida especifica sobre o carro para que eu possa ajudar?`,
  },
  {
    id: 'mensagem_saudacao_padrao_2',
    titulo: 'Modelo 2',
    texto: `Olá, {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}! Tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Recebemos o seu cadastro mostrando interesse em um de nossos veículos. Estou aqui para agilizar seu atendimento e te passar todos os detalhes o mais rápido possível!

Para começarmos, o que você prefere: ver mais fotos do carro, entender as opções de financiamento ou tirar alguma dúvida específica?`,
  },
  {
    id: 'mensagem_saudacao_padrao_3',
    titulo: 'Modelo 3',
    texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro, e estou entrando em contato para fazer o seu primeiro atendimento.

Como posso te ajudar?`,
  },
  {
    id: 'mensagem_saudacao_padrao_4',
    titulo: 'Modelo 4',
    texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um carro.

Você tem alguma dúvida especifica sobre o carro?`,
  },
];

const saudacaoModelosImobiliaria = [
  {
    id: 'mensagem_saudacao_padrao_imobiliaria_1',
    titulo: 'Modelo 1',
    texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um imóvel, e estou entrando em contato para fazer o seu primeiro atendimento.

Você tem alguma dúvida especifica que eu possa ajudar?`,
  },
  {
    id: 'mensagem_saudacao_padrao_imobiliaria_2',
    titulo: 'Modelo 2',
    texto: `Olá, {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}! Tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Recebemos o seu cadastro mostrando interesse em um de nossos imóveis. Estou aqui para agilizar seu atendimento e te passar todos os detalhes o mais rápido possível!

Para começarmos, o que você prefere: ver mais fotos ou tirar alguma dúvida específica?`,
  },
  {
    id: 'mensagem_saudacao_padrao_imobiliaria_3',
    titulo: 'Modelo 3',
    texto: `Olá {{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}, tudo bem?

Aqui é a Julia da {{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}. Você preencheu nosso formulário demonstrando interesse em um imóvel, e estou entrando em contato para fazer o seu primeiro atendimento.

Como posso te ajudar?`,
  },
];

export const getSaudacaoModelos = (tipo: unknown) =>
  String(tipo || '').trim().toLowerCase() === 'imobiliaria' ? saudacaoModelosImobiliaria : saudacaoModelosLojaDeCarros;

const saudacaoVariaveis = [
  {
    raw: "{{ $('CAMPOS DE ENTRADA').first().json.lead_nome_pessoa }}",
    label: '{{NOME}}',
  },
  {
    raw: "{{ $('CAMPOS DE ENTRADA').first().json.user_empresa }}",
    label: '{{NOME DA EMPRESA}}',
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const renderSaudacaoTexto = (texto: string) => {
  const raw = String(texto || '');
  if (!raw) return raw;
  const pattern = new RegExp(`(${saudacaoVariaveis.map((v) => escapeRegExp(v.raw)).join('|')})`, 'g');
  return raw.split(pattern).map((part, idx) => {
    const variable = saudacaoVariaveis.find((v) => v.raw === part);
    if (!variable) return <React.Fragment key={idx}>{part}</React.Fragment>;
    return (
      <span key={idx} className="font-bold">
        {variable.label}
      </span>
    );
  });
};
