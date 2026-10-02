import React from 'react';
import { Crown } from 'lucide-react';
import InfoTip from '@/components/InfoTip';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

/** Dados do ciclo calculados pelo hook de configuração de cada aba. */
export interface FollowUpCicloResumo {
  inicioFormatado: string;
  fimFormatado: string;
  diaVencimentoNum: number | null;
  enviadosCiclo: number;
  volumeValido: number;
  pendentesCiclo: number;
  progressoCiclo: number;
}

const formatNumber = (value: number | string) => Number(value).toLocaleString('pt-BR');

/** Cartão "Resumo do plano": volume, ciclo atual e utilização. Igual para Dinâmico e Extendido. */
const FollowUpResumoPlano = ({
  id,
  ativo,
  volume,
  ciclo,
}: {
  id: string;
  ativo: boolean;
  volume: string;
  ciclo: FollowUpCicloResumo;
}) => {
  const volumeTotal = ciclo.volumeValido > 0 ? formatNumber(ciclo.volumeValido) : volume ? formatNumber(volume) : '-';
  const pendentes = ciclo.volumeValido > 0 ? formatNumber(ciclo.pendentesCiclo) : volume ? formatNumber(volume) : '-';

  return (
    <section className="wl-set-card" aria-labelledby={`${id}-resumo`}>
      <div className="wl-set-card__head">
        <div className="wl-set-card__id">
          <span className="wl-set-card__icon"><Crown aria-hidden="true" /></span>
          <h3 id={`${id}-resumo`} className="wl-set-card__title">
            Resumo do plano
            <span className={`wl-tag ${ativo ? 'wl-tag--won' : 'wl-tag--idle'}`}>{ativo ? 'Ativo' : 'Inativo'}</span>
            <InfoTip label="Status do plano">
              <p>Indica se a funcionalidade está habilitada para o seu plano.</p>
            </InfoTip>
          </h3>
        </div>
      </div>

      <div className="wl-set-tiles">
        <div className="wl-set-tile">
          <div className="wl-set-tile__top">
            <span className="wl-label">Volume por ciclo</span>
            <InfoTip label="Volume por ciclo">
              <p>Quantidade máxima de FollowUps que o plano pode enviar por ciclo.</p>
            </InfoTip>
          </div>
          <span className="wl-set-tile__value">{volume ? formatNumber(volume) : '-'}</span>
          <span className="wl-set-tile__meta">FollowUps</span>
        </div>

        <div className="wl-set-tile">
          <span className="wl-label">Ciclo atual</span>
          <span className="wl-set-tile__value wl-set-tile__value--sm">
            {ciclo.inicioFormatado} até {ciclo.fimFormatado}
          </span>
          <span className="wl-set-tile__meta">
            Vencimento dia <strong>{ciclo.diaVencimentoNum !== null ? String(ciclo.diaVencimentoNum) : '-'}</strong>
          </span>
        </div>
      </div>

      <div className="wl-set-box">
        <div className="wl-usage">
          <div>
            <p className="wl-usage__title">FollowUps do ciclo</p>
            <p className="wl-usage__range">
              {ciclo.inicioFormatado} até {ciclo.fimFormatado}
            </p>
          </div>
          <div>
            <span className="wl-label">Utilização</span>
            <div className="wl-usage__num">
              {formatNumber(ciclo.enviadosCiclo)} <span>/</span> {volumeTotal}
            </div>
          </div>
        </div>

        <div className="wl-meter" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ciclo.progressoCiclo)}>
          <div className="wl-meter__fill" style={{ width: `${ciclo.progressoCiclo}%` }} />
        </div>

        <div className="wl-legend">
          <div>
            <span className="wl-legend__dot" />
            Enviados
            <strong>{formatNumber(ciclo.enviadosCiclo)}</strong>
          </div>
          <div>
            <span className="wl-legend__dot wl-legend__dot--soft" />
            Pendentes
            <strong>{pendentes}</strong>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FollowUpResumoPlano;
