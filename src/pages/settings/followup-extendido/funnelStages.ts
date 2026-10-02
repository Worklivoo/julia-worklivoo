// Valores idênticos ao enum "lead_etapa" no banco (case-sensitive no PostgREST) — não usar
// PIPELINE_STAGES aqui, pois seus rótulos têm capitalização diferente do enum real e
// quebrariam o filtro `lead_etapa in (...)` da automação de envio no n8n.
export const FUNNEL_STAGES: { value: string; label: string }[] = [
  { value: 'Entrada do lead', label: 'Entrada do Lead' },
  { value: 'Tentando contato', label: 'Tentando Contato' },
  { value: 'Contato realizado', label: 'Contato Realizado' },
  { value: 'Oportunidade qualificada', label: 'Oportunidade Qualificada' },
  { value: 'Orçamento/Negociação', label: 'Orçamento/Negociação' },
  { value: 'Venda', label: 'Venda' },
];
