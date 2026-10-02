import React from 'react';
import { useFollowUpDinamicoConfig } from './followup-dinamico/useFollowUpDinamicoConfig';
import { useFollowUpPagamento } from './followup-comum/useFollowUpPagamento';
import { FOLLOWUP_DINAMICO } from './followup-comum/kinds';
import FollowUpDinamicoAtivo from './followup-dinamico/FollowUpDinamicoAtivo';
import FollowUpContratar from './followup-comum/FollowUpContratar';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

interface FollowUpDinamicoTabProps {
  user: any;
  settingsOwnerUserId: string | null;
}

/**
 * Aba "FollowUp Dinâmico" das Configurações.
 * - Carregando: aviso simples.
 * - Funcionalidade inativa: tela de contratação (plano, rateio e pagamento via PIX).
 * - Funcionalidade ativa: resumo do ciclo, janela de dias e histórico de envios.
 *
 * Lógica em `followup-dinamico/useFollowUpDinamico*.ts`; telas nos demais arquivos da pasta.
 */
export const FollowUpDinamicoTab: React.FC<FollowUpDinamicoTabProps> = ({ user, settingsOwnerUserId }) => {
  const config = useFollowUpDinamicoConfig({ user, settingsOwnerUserId });
  const pagamento = useFollowUpPagamento({
    kind: FOLLOWUP_DINAMICO,
    user,
    settingsOwnerUserId,
    config: {
      userPagamentoConfig: config.userPagamentoConfig,
      setUserPagamentoConfig: config.setUserPagamentoConfig,
      setLoading: config.setLoadingFollowupDinamicoConfig,
      setAtivo: config.setFollowupDinamicoAtivo,
      setVolume: config.setFollowupDinamicoVolume,
      setDiasPerdidos: config.setFollowupDinamicoDiasPerdidos,
    },
  });

  if (config.loadingFollowupDinamicoConfig) {
    return (
      <div className="wl-tabpane">
        <p className="wl-clist__note wl-clist__note--center">Carregando...</p>
      </div>
    );
  }

  if (!config.followupDinamicoAtivo) {
    return <FollowUpContratar kind={FOLLOWUP_DINAMICO} pagamento={pagamento} />;
  }

  return <FollowUpDinamicoAtivo config={config} />;
};
