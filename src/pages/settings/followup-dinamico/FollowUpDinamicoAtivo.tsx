import React from 'react';
import { Database } from 'lucide-react';
import InfoTip from '@/components/InfoTip';
import type { FollowUpDinamicoConfig } from './useFollowUpDinamicoConfig';
import { FOLLOWUP_DINAMICO } from '../followup-comum/kinds';
import FollowUpResumoPlano from '../followup-comum/FollowUpResumoPlano';
import FollowUpHistorico from '../followup-comum/FollowUpHistorico';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

const formatNumber = (value: number | string) => Number(value).toLocaleString('pt-BR');

/** Aba FollowUp Dinâmico com a funcionalidade ativa: resumo, janela de dias e histórico. */
const FollowUpDinamicoAtivo = ({ config }: { config: FollowUpDinamicoConfig }) => {
  const {
    followupDinamicoAtivo,
    followupDinamicoVolume,
    followupDinamicoDiasPerdidos,
    setFollowupDinamicoDiasPerdidos,
    isSavingFollowupDinamicoConfig,
    isEditingFollowupDinamicoDias,
    setIsEditingFollowupDinamicoDias,
    followupDinamicoCiclo,
    handleSaveFollowupDinamicoConfig,
  } = config;

  const diasLabel = followupDinamicoDiasPerdidos
    ? `${formatNumber(followupDinamicoDiasPerdidos)} dia${Number(followupDinamicoDiasPerdidos) === 1 ? '' : 's'}`
    : 'Não definido';

  return (
    <div className="wl-tabpane">
      <header className="wl-tabhead">
        <div>
          <h2 className="wl-section__title">FollowUp Dinâmico</h2>
          <p className="wl-lede">{FOLLOWUP_DINAMICO.copy.ativoLede}</p>
        </div>
        <span className={`wl-tag ${followupDinamicoAtivo ? 'wl-tag--won' : 'wl-tag--idle'}`}>
          {followupDinamicoAtivo ? 'Funcionalidade ativa' : 'Funcionalidade inativa'}
        </span>
      </header>

      <div className="wl-set-grid">
        <FollowUpResumoPlano
          id="fud"
          ativo={followupDinamicoAtivo}
          volume={followupDinamicoVolume}
          ciclo={followupDinamicoCiclo}
        />

        <section className="wl-set-card is-first-mobile" aria-labelledby="fud-dias">
          <div className="wl-set-card__head">
            <div className="wl-set-card__id">
              <span className="wl-set-card__icon"><Database aria-hidden="true" /></span>
              <div>
                <h3 id="fud-dias" className="wl-set-card__title">Configuração de dias</h3>
                <p className="wl-set-card__sub">Ajuste a janela de busca por leads perdidos para recontato.</p>
              </div>
            </div>
            <span className={`wl-tag ${followupDinamicoDiasPerdidos ? 'wl-tag--plain' : 'wl-tag--idle'}`}>{diasLabel}</span>
          </div>

          <div className="wl-set-box">
            <div className="wl-field">
              <div className="wl-set-tile__top">
                <label className="wl-label" htmlFor="fud-dias-input">Dias para buscar leads perdidos</label>
                <InfoTip label="Dias para buscar leads perdidos">
                  <p>Exemplo: 30 = considera leads perdidos dos últimos 30 dias para recontato (mínimo 30, máximo 360).</p>
                </InfoTip>
              </div>
              <div className="wl-input-row">
                <input
                  id="fud-dias-input"
                  className="wl-input"
                  type="number"
                  inputMode="numeric"
                  min={30}
                  max={360}
                  placeholder="Ex: 30"
                  value={followupDinamicoDiasPerdidos}
                  onChange={(e) => setFollowupDinamicoDiasPerdidos(e.target.value)}
                  disabled={!isEditingFollowupDinamicoDias}
                />
                {!isEditingFollowupDinamicoDias ? (
                  <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setIsEditingFollowupDinamicoDias(true)}>
                    Editar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="wl-btn wl-btn--lime"
                    onClick={handleSaveFollowupDinamicoConfig}
                    disabled={isSavingFollowupDinamicoConfig}
                  >
                    {isSavingFollowupDinamicoConfig ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </div>

            <ul className="wl-bullets">
              <li>
                Defina por quantos dias o sistema deve considerar os leads perdidos para enviar novos follow-ups quando surgir uma oportunidade relevante para eles.
              </li>
              <li>
                <strong>Exemplo:</strong> se você configurar 30 dias, o sistema poderá reativar leads que foram marcados como perdidos nos últimos 30 dias.
              </li>
              <li>
                <strong>Período:</strong> mínimo de 30 dias e máximo de 360 dias.
              </li>
            </ul>
          </div>
        </section>
      </div>

      <FollowUpHistorico
        kind={FOLLOWUP_DINAMICO}
        historico={config.followupDinamicoHistorico}
        loading={config.loadingFollowupDinamicoHistorico}
      />
    </div>
  );
};

export default FollowUpDinamicoAtivo;
