import React from 'react';
import { useFollowUpExtendidoConfig } from './followup-extendido/useFollowUpExtendidoConfig';
import { useFollowUpPagamento } from './followup-comum/useFollowUpPagamento';
import { FOLLOWUP_EXTENDIDO } from './followup-comum/kinds';
import FollowUpContratar from './followup-comum/FollowUpContratar';
import FollowUpExtendidoAtivo from './followup-extendido/FollowUpExtendidoAtivo';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

interface FollowUpExtendidoTabProps {
  user: any;
  settingsOwnerUserId: string | null;
}

/**
 * Aba "FollowUp Extendido" das Configurações.
 * - Carregando: aviso simples.
 * - Funcionalidade inativa: tela de contratação (plano, rateio e pagamento via PIX), compartilhada com o Dinâmico.
 * - Funcionalidade ativa: resumo do ciclo, dias, frequência, etapas do funil e histórico de envios.
 *
 * Lógica em `followup-extendido/useFollowUpExtendidoConfig.ts` e `followup-comum/useFollowUpPagamento.ts`.
 */
export const FollowUpExtendidoTab: React.FC<FollowUpExtendidoTabProps> = ({ user, settingsOwnerUserId }) => {
  const config = useFollowUpExtendidoConfig({ user, settingsOwnerUserId });
  const pagamento = useFollowUpPagamento({
    kind: FOLLOWUP_EXTENDIDO,
    user,
    settingsOwnerUserId,
    config: {
      userPagamentoConfig: config.userPagamentoConfig,
      setUserPagamentoConfig: config.setUserPagamentoConfig,
      setLoading: config.setLoadingFollowupExtendidoConfig,
      setAtivo: config.setFollowupExtendidoAtivo,
      setVolume: config.setFollowupExtendidoVolume,
      setDiasPerdidos: config.setFollowupExtendidoDiasPerdidos,
    },
  });

  if (config.loadingFollowupExtendidoConfig) {
    return (
      <div className="wl-tabpane">
        <p className="wl-clist__note wl-clist__note--center">Carregando...</p>
      </div>
    );
  }

  if (!config.followupExtendidoAtivo) {
    return <FollowUpContratar kind={FOLLOWUP_EXTENDIDO} pagamento={pagamento} />;
  }

  return <FollowUpExtendidoAtivo config={config} />;
};
