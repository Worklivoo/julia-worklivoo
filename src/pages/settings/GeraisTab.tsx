import React from 'react';
import { useGerais } from './gerais/useGerais';
import ContaCard from './gerais/ContaCard';
import DistribuicaoCard from './gerais/DistribuicaoCard';
import LeadsWhatsappCard from './gerais/LeadsWhatsappCard';
import SaudacaoCard from './gerais/SaudacaoCard';
import FollowupFluxoCard from './gerais/FollowupFluxoCard';
import TransbordoCard from './gerais/TransbordoCard';
import GoogleAvaliacaoCard from './gerais/GoogleAvaliacaoCard';
import FonteDadosCard from './gerais/FonteDadosCard';
import ReceiveMethodDialog from './gerais/ReceiveMethodDialog';
import TransbordoEtapasDialog from './gerais/TransbordoEtapasDialog';
import TransbordoMetodoDialog from './gerais/TransbordoMetodoDialog';
import GoogleAvaliacaoDialog from './gerais/GoogleAvaliacaoDialog';
import FonteDadosDialog from './gerais/FonteDadosDialog';
import AlterarSenhaDialog from './gerais/AlterarSenhaDialog';
import TermosDialog from './gerais/TermosDialog';
import SaudacaoModeloDialog from './gerais/SaudacaoModeloDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

interface GeraisTabProps {
  user: any;
  settingsOwnerUserId: string;
}

/**
 * Aba "Gerais" das Configurações: dados da conta à esquerda e, à direita, os cartões de
 * distribuição de leads, WhatsApp, saudação, FollowUp, transbordo, Google Avaliação e fonte de dados.
 *
 * Lógica em `gerais/useGerais.ts`; cada cartão e cada diálogo tem o seu arquivo em `gerais/`.
 */
export const GeraisTab: React.FC<GeraisTabProps> = ({ user, settingsOwnerUserId }) => {
  const g = useGerais({ user, settingsOwnerUserId });

  return (
    <>
      <div className="wl-gerais">
        <ContaCard user={user} g={g} />
        <div className="wl-gerais__stack">
          <DistribuicaoCard g={g} />
          <LeadsWhatsappCard g={g} />
          <SaudacaoCard g={g} />
          <FollowupFluxoCard user={user} g={g} />
          <TransbordoCard g={g} />
          <GoogleAvaliacaoCard g={g} />
          <FonteDadosCard g={g} />
        </div>
      </div>

      <ReceiveMethodDialog g={g} />
      <TransbordoEtapasDialog g={g} />
      <TransbordoMetodoDialog g={g} />
      <GoogleAvaliacaoDialog g={g} />
      <FonteDadosDialog g={g} />
      <AlterarSenhaDialog g={g} />
      <TermosDialog g={g} />
      <SaudacaoModeloDialog g={g} />
    </>
  );
};

export default GeraisTab;
