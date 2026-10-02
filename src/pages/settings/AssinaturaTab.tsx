import React from 'react';
import { useAssinatura } from './assinatura/useAssinatura';
import EscolherPagamento from './assinatura/EscolherPagamento';
import PixPagamento from './assinatura/PixPagamento';
import ConfigurarAssinatura from './assinatura/ConfigurarAssinatura';
import AssinaturaAtiva from './assinatura/AssinaturaAtiva';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

/**
 * Aba "Assinatura" das Configurações (cobrança via Asaas). Quatro telas:
 * escolha da forma de pagamento, PIX da primeira cobrança, configuração (faturamento e cartão)
 * e a assinatura ativa. Toda a lógica de cobrança está em `assinatura/useAssinatura.ts`.
 */
export const AssinaturaTab: React.FC = () => {
  const a = useAssinatura();

  if (!a.isSetupComplete) {
    if (!a.paymentMethod) return <EscolherPagamento a={a} />;
    if (a.pixPaymentData && !a.isCardSaved) return <PixPagamento a={a} />;
    return <ConfigurarAssinatura a={a} />;
  }

  return <AssinaturaAtiva a={a} />;
};

export default AssinaturaTab;
