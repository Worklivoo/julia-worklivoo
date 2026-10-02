import React from 'react';
import { Clock } from 'lucide-react';
import WhatsAppLogo from '../WhatsAppLogo';
import { useApiOficial } from './useApiOficial';
import ApiOficialDddDialog from './ApiOficialDddDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

/**
 * Ativação da API Oficial para contas que ainda não a têm (recomendada pela equipe):
 * criar (escolhe o DDD), análise em andamento, integrar ou carregando o próximo passo.
 */
const ApiOficialAtivacao = () => {
  const a = useApiOficial();

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">API Oficial do WhatsApp</h3>
          <p className="wl-lede">Gerencie a ativação da sua API Oficial em um fluxo dedicado.</p>
        </div>
      </div>

      <section className="wl-set-card">
        {!a.hasSalvyId && !a.startingCreateApiOfficialFlow ? (
          <div className="wl-wa-state">
            <span className="wl-wa-state__icon"><WhatsAppLogo size={26} /></span>
            <h3>Criar uma nova API Oficial</h3>
            <p>Inicie o processo de criação da sua API Oficial do WhatsApp.</p>
            <button type="button" className="wl-btn wl-btn--lime" onClick={a.handleStartCreateApiOfficial} disabled={a.loadingSalvyAreaCodes}>
              {a.loadingSalvyAreaCodes ? 'Carregando DDDs...' : 'Criar uma nova API Oficial'}
            </button>
          </div>
        ) : a.hasSalvyId && !a.hasWabaId ? (
          <div className="wl-wa-state">
            <span className="wl-wa-state__icon"><Clock aria-hidden="true" /></span>
            <h3>Análise em andamento</h3>
            <p>Nossa equipe interna está analisando os dados e a API Oficial será liberada o quanto antes!</p>
          </div>
        ) : a.hasWabaId ? (
          <div className="wl-wa-state">
            <span className="wl-wa-state__icon"><WhatsAppLogo size={26} /></span>
            <h3>Integrar API Oficial</h3>
            <p>Sua API Oficial já avançou para a próxima etapa. Continue a integração por este botão.</p>
            <button
              type="button"
              className="wl-btn wl-btn--lime"
              onClick={a.handleIntegrateApiOfficial}
              disabled={a.sendingIntegrateApiOfficialWebhook}
            >
              {a.sendingIntegrateApiOfficialWebhook ? 'Enviando...' : 'Integrar API Oficial'}
            </button>
          </div>
        ) : (
          <div className="wl-wa-state" role="status">
            <span className="wl-wa-state__icon"><span className="wl-spin wl-spin--lg" aria-hidden="true" /></span>
            <h3>Carregando</h3>
            <p>Estamos preparando o próximo passo da sua API Oficial.</p>
          </div>
        )}
      </section>

      <ApiOficialDddDialog a={a} />
    </div>
  );
};

export default ApiOficialAtivacao;
