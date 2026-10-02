/** Variações entre os dois FollowUps pagos (Dinâmico e Extendido). Todo o fluxo de contratação é o mesmo. */
export interface FollowUpKind {
  id: 'dinamico' | 'extendido';
  /** Nome exibido: "FollowUp {nome}". */
  nome: 'Dinâmico' | 'Extendido';
  /** Prefixo dos logs de depuração. */
  logTag: string;
  /** Chave do localStorage que guarda a cobrança em andamento. */
  storagePrefix: string;
  /** Prefixo do externalReference enviado ao Asaas. */
  externalRefPrefix: string;
  /** Nome-base do arquivo do PDF do PIX. */
  pdfFileName: string;
  /** Colunas em usuarios_v2. */
  columns: { ativo: string; volume: string; dias: string };
  /** Texto de cada plano (o resto — preço, volume — é igual). */
  planDescricao: { essencial: string; pro: string; empresarial: string };
  /** Itens de "O que está incluso" no plano. */
  planIncludes: string[];
  /** Textos da tela de contratação e da tela ativa. */
  copy: {
    contratarLede: string;
    steps: { title: string; desc: string }[];
    resultFrom: string;
    resultTo: string;
    ativoLede: string;
  };
}

export const FOLLOWUP_DINAMICO: FollowUpKind = {
  id: 'dinamico',
  nome: 'Dinâmico',
  logTag: 'FU Dinamico',
  storagePrefix: 'fu_dinamico_pagamento_',
  externalRefPrefix: 'FU_DINAMICO',
  pdfFileName: 'PIX_FollowUp_Dinamico',
  columns: {
    ativo: 'followup_dinamico',
    volume: 'followup_dinamico_volume',
    dias: 'followup_dinamico_dias_perdidos',
  },
  planDescricao: {
    essencial: 'Ideal para quem está começando a reativar leads perdidos.',
    pro: 'Perfeito para equipes que recebem muitas oportunidades novas.',
    empresarial: 'Alto volume para empresas com base grande de leads.',
  },
  planIncludes: [
    'Janela de 30 a 360 dias para leads perdidos',
    'Histórico completo de envios',
    'Envios automáticos via IA',
  ],
  copy: {
    contratarLede: 'Um “não agora” não precisa ser um “não para sempre”. Continue trabalhando leads perdidos de forma automática.',
    steps: [
      { title: 'O lead demonstra interesse', desc: 'O lead entra em contato buscando algo específico e a operação identifica a oportunidade inicial.' },
      { title: 'Não existe oportunidade agora', desc: 'O lead é marcado como perdido e a operação para de investir nele naquele momento.' },
      { title: 'Sistema continua acompanhando', desc: 'O FollowUp Dinâmico mantém esse lead no radar por uma janela de 30 a 360 dias.' },
      { title: 'Lead reativado automaticamente', desc: 'A IA identifica uma nova janela de oportunidade e inicia um follow-up automático.' },
    ],
    resultFrom: 'Lead perdido sem retorno',
    resultTo: 'Lead reativado automaticamente',
    ativoLede: 'Configure os parâmetros e acompanhe os FollowUps enviados automaticamente para leads perdidos.',
  },
};

export const FOLLOWUP_EXTENDIDO: FollowUpKind = {
  id: 'extendido',
  nome: 'Extendido',
  logTag: 'FU Extendido',
  storagePrefix: 'fu_extendido_pagamento_',
  externalRefPrefix: 'FU_EXTENDIDO',
  pdfFileName: 'PIX_FollowUp_Extendido',
  columns: {
    ativo: 'followup_extendido',
    volume: 'followup_extendido_volume',
    dias: 'followup_extendido_dias_perdidos',
  },
  planDescricao: {
    essencial: 'Ideal para quem está começando a reengajar leads sem resposta.',
    pro: 'Perfeito para equipes que recebem muitas oportunidades novas.',
    empresarial: 'Alto volume para empresas com base grande de leads.',
  },
  planIncludes: [
    'Janela de 7 a 360 dias para leads sem resposta',
    'Filtro por etapa do funil',
    'Histórico completo de envios',
    'Envios automáticos via IA',
  ],
  copy: {
    contratarLede: 'Um “não agora” não precisa ser um “não para sempre”. Continue trabalhando leads sem resposta de forma automática.',
    steps: [
      { title: 'O lead avança no funil', desc: 'O lead é atendido normalmente e chega a etapas como Contato Realizado ou Oportunidade Qualificada.' },
      { title: 'O lead para de responder', desc: 'Sem retorno do lead, a operação para de insistir e ele fica parado naquela etapa do funil.' },
      { title: 'Sistema continua acompanhando', desc: 'O FollowUp Extendido monitora esse lead por uma janela de 7 a 360 dias sem resposta, configurável por você.' },
      { title: 'Lead reengajado automaticamente', desc: 'Passado o prazo configurado, um follow-up automático é enviado para tentar reengajar o lead.' },
    ],
    resultFrom: 'Lead sem resposta',
    resultTo: 'Lead reengajado automaticamente',
    ativoLede: 'Configure os parâmetros e acompanhe os FollowUps enviados automaticamente para leads sem resposta.',
  },
};
