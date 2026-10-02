import React from 'react';
import { BarChart3, Database } from 'lucide-react';
import InfoTip from '@/components/InfoTip';
import type { FollowUpExtendidoConfig } from './useFollowUpExtendidoConfig';
import { FUNNEL_STAGES } from './funnelStages';
import { FOLLOWUP_EXTENDIDO } from '../followup-comum/kinds';
import FollowUpResumoPlano from '../followup-comum/FollowUpResumoPlano';
import FollowUpHistorico from '../followup-comum/FollowUpHistorico';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

const formatNumber = (value: number | string) => Number(value).toLocaleString('pt-BR');

/** Aba FollowUp Extendido com a funcionalidade ativa: resumo, envio (dias e frequência), etapas e histórico. */
const FollowUpExtendidoAtivo = ({ config }: { config: FollowUpExtendidoConfig }) => {
  const {
    followupExtendidoAtivo,
    followupExtendidoVolume,
    followupExtendidoDiasPerdidos,
    setFollowupExtendidoDiasPerdidos,
    followupExtendidoFrequencia,
    setFollowupExtendidoFrequencia,
    followupExtendidoEtapas,
    setFollowupExtendidoEtapas,
    loadingFollowupExtendidoConfig,
    isSavingFollowupExtendidoConfig,
    isEditingFollowupExtendidoDias,
    setIsEditingFollowupExtendidoDias,
    isEditingFollowupExtendidoEtapas,
    setIsEditingFollowupExtendidoEtapas,
    followupExtendidoCiclo,
    handleSaveFollowupExtendidoConfig,
  } = config;

  const saving = isSavingFollowupExtendidoConfig || loadingFollowupExtendidoConfig;
  const diasLabel = followupExtendidoDiasPerdidos
    ? `${formatNumber(followupExtendidoDiasPerdidos)} dia${Number(followupExtendidoDiasPerdidos) === 1 ? '' : 's'}`
    : 'Dias: não definido';
  const frequenciaLabel = followupExtendidoFrequencia
    ? `${formatNumber(followupExtendidoFrequencia)}x por lead`
    : 'Frequência: não definida';
  const etapasLabel =
    followupExtendidoEtapas.length > 0
      ? `${followupExtendidoEtapas.length} etapa${followupExtendidoEtapas.length === 1 ? '' : 's'}`
      : 'Não definido';

  return (
    <div className="wl-tabpane">
      <header className="wl-tabhead">
        <div>
          <h2 className="wl-section__title">FollowUp Extendido</h2>
          <p className="wl-lede">{FOLLOWUP_EXTENDIDO.copy.ativoLede}</p>
        </div>
        <span className={`wl-tag ${followupExtendidoAtivo ? 'wl-tag--won' : 'wl-tag--idle'}`}>
          {followupExtendidoAtivo ? 'Funcionalidade ativa' : 'Funcionalidade inativa'}
        </span>
      </header>

      <div className="wl-set-grid">
        <FollowUpResumoPlano
          id="fue"
          ativo={followupExtendidoAtivo}
          volume={followupExtendidoVolume}
          ciclo={followupExtendidoCiclo}
        />

        <section className="wl-set-card is-first-mobile" aria-labelledby="fue-envio">
          <div className="wl-set-card__head">
            <div className="wl-set-card__id">
              <span className="wl-set-card__icon"><Database aria-hidden="true" /></span>
              <div>
                <h3 id="fue-envio" className="wl-set-card__title">Configuração de envio</h3>
                <p className="wl-set-card__sub">
                  Ajuste a janela de busca por leads sem resposta e quantas vezes tentar o mesmo lead.
                </p>
              </div>
            </div>
            <div className="wl-tags">
              <span className={`wl-tag ${followupExtendidoDiasPerdidos ? 'wl-tag--plain' : 'wl-tag--idle'}`}>{diasLabel}</span>
              <span className={`wl-tag ${followupExtendidoFrequencia ? 'wl-tag--plain' : 'wl-tag--idle'}`}>{frequenciaLabel}</span>
            </div>
          </div>

          <div className="wl-set-box">
            <div className="wl-field">
              <div className="wl-set-tile__top">
                <label className="wl-label" htmlFor="fue-dias-input">Dias sem resposta para buscar leads</label>
                <InfoTip label="Dias sem resposta">
                  <p>Exemplo: 30 = considera leads sem resposta há até 30 dias para recontato (mínimo 7, máximo 360).</p>
                </InfoTip>
              </div>
              <input
                id="fue-dias-input"
                className="wl-input"
                type="number"
                inputMode="numeric"
                min={7}
                max={360}
                placeholder="Ex: 30"
                value={followupExtendidoDiasPerdidos}
                onChange={(e) => setFollowupExtendidoDiasPerdidos(e.target.value)}
                disabled={!isEditingFollowupExtendidoDias}
              />
            </div>

            <div className="wl-field">
              <div className="wl-set-tile__top">
                <label className="wl-label" htmlFor="fue-freq-input">Frequência de mensagens por lead</label>
                <InfoTip label="Frequência de mensagens">
                  <p>
                    Exemplo: 3 = tenta reengajar o mesmo lead até 3 vezes (respeitando sempre os dias sem resposta entre uma tentativa e outra) antes de parar (mínimo 1, máximo 50).
                  </p>
                </InfoTip>
              </div>
              <div className="wl-input-row">
                <input
                  id="fue-freq-input"
                  className="wl-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  placeholder="Ex: 3"
                  value={followupExtendidoFrequencia}
                  onChange={(e) => setFollowupExtendidoFrequencia(e.target.value)}
                  disabled={!isEditingFollowupExtendidoDias}
                />
                {!isEditingFollowupExtendidoDias ? (
                  <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setIsEditingFollowupExtendidoDias(true)}>
                    Editar
                  </button>
                ) : (
                  <button type="button" className="wl-btn wl-btn--lime" onClick={handleSaveFollowupExtendidoConfig} disabled={saving}>
                    {isSavingFollowupExtendidoConfig ? 'Salvando...' : 'Salvar'}
                  </button>
                )}
              </div>
            </div>

            <ul className="wl-bullets">
              <li>
                Defina por quantos dias o lead pode ficar sem responder, dentro das etapas selecionadas, antes de receber um novo follow-up automático, e quantas vezes no máximo tentar reengajar o mesmo lead.
              </li>
              <li>
                <strong>Exemplo:</strong> com 30 dias e frequência 3, o sistema envia um follow-up a cada 30 dias sem resposta, até no máximo 3 tentativas para o mesmo lead.
              </li>
              <li>
                <strong>Período:</strong> dias entre 7 e 360. Frequência entre 1 e 50 tentativas por lead.
              </li>
            </ul>
          </div>
        </section>

        <section className="wl-set-card wl-set-card--wide" aria-labelledby="fue-etapas">
          <div className="wl-set-card__head">
            <div className="wl-set-card__id">
              <span className="wl-set-card__icon"><BarChart3 aria-hidden="true" /></span>
              <div>
                <h3 id="fue-etapas" className="wl-set-card__title">Configuração de etapas</h3>
                <p className="wl-set-card__sub">
                  Escolha em quais etapas do funil o lead precisa estar para receber o FollowUp Extendido.
                </p>
              </div>
            </div>
            <span className={`wl-tag ${followupExtendidoEtapas.length > 0 ? 'wl-tag--plain' : 'wl-tag--idle'}`}>{etapasLabel}</span>
          </div>

          <div className="wl-set-box">
            <div className="wl-set-tile__top">
              <span className="wl-label">Etapas do funil elegíveis</span>
              <InfoTip label="Etapas elegíveis">
                <p>Somente leads que estiverem em uma das etapas marcadas vão receber o FollowUp Extendido.</p>
              </InfoTip>
            </div>

            <div className="wl-optgrid" role="group" aria-label="Etapas do funil elegíveis">
              {FUNNEL_STAGES.map((stage) => {
                const checked = followupExtendidoEtapas.includes(stage.value);
                return (
                  <label key={stage.value} className={`wl-opt ${isEditingFollowupExtendidoEtapas ? '' : 'is-locked'}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!isEditingFollowupExtendidoEtapas}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setFollowupExtendidoEtapas((prev) =>
                          isChecked ? [...prev, stage.value] : prev.filter((valor) => valor !== stage.value),
                        );
                      }}
                    />
                    <span>{stage.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="wl-lp-actions">
              {!isEditingFollowupExtendidoEtapas ? (
                <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => setIsEditingFollowupExtendidoEtapas(true)}>
                  Editar
                </button>
              ) : (
                <button type="button" className="wl-btn wl-btn--lime" onClick={handleSaveFollowupExtendidoConfig} disabled={saving}>
                  {isSavingFollowupExtendidoConfig ? 'Salvando...' : 'Salvar'}
                </button>
              )}
            </div>

            <ul className="wl-bullets">
              <li>Defina em quais etapas do funil o lead precisa estar para ser elegível ao FollowUp Extendido.</li>
              <li>
                <strong>Exemplo:</strong> marcando “Contato Realizado” e “Oportunidade Qualificada”, só leads nessas duas etapas entram no envio.
              </li>
              <li>
                <strong>Obrigatório:</strong> selecione ao menos uma etapa.
              </li>
            </ul>
          </div>
        </section>
      </div>

      <FollowUpHistorico
        kind={FOLLOWUP_EXTENDIDO}
        historico={config.followupExtendidoHistorico}
        loading={config.loadingFollowupExtendidoHistorico}
      />
    </div>
  );
};

export default FollowUpExtendidoAtivo;
