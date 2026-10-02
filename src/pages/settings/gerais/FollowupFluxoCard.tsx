import React from 'react';
import { History } from 'lucide-react';
import type { GeraisCtx } from './useGerais';
import GeraisCard, { EditButton } from './GeraisCard';

/** Frequência e quantidade de tentativas de FollowUp quando o lead fica sem responder. */
const FollowupFluxoCard = ({ user, g }: { user: any; g: GeraisCtx }) => {
  const temSalvo = g.frequenciaFollowupSalva.trim().length > 0 || g.quantidadeMaximaFollowupSalva.trim().length > 0;
  const mostrandoResumo = temSalvo && !g.isEditingFrequenciaFollowup;
  const min = user.api_oficial ? 1 : 6;
  const max = user.api_oficial ? 8 : 36;

  return (
    <GeraisCard
      id="ger-fluxo-followup"
      icon={<History aria-hidden="true" />}
      title="Fluxo de FollowUp"
      sub="Configure a frequência e a quantidade de tentativas que a IA fará para retomar o contato com o lead sempre que ele ficar sem resposta por um determinado período."
      action={mostrandoResumo ? <EditButton onClick={() => g.setIsEditingFrequenciaFollowup(true)} /> : undefined}
    >
      {g.loadingFrequenciaFollowup ? (
        <p className="wl-clist__note">Carregando...</p>
      ) : mostrandoResumo ? (
        <div className="wl-set-tiles">
          <div className="wl-set-tile">
            <span className="wl-label">Frequência atual</span>
            <span className="wl-set-tile__value">{g.frequenciaFollowupSalva ? `${g.frequenciaFollowupSalva}h` : '-'}</span>
          </div>
          <div className="wl-set-tile">
            <span className="wl-label">Quantidade de FollowUp</span>
            <span className="wl-set-tile__value">{g.quantidadeMaximaFollowupSalva ? `${g.quantidadeMaximaFollowupSalva}x` : '-'}</span>
          </div>
        </div>
      ) : (
        <div className="wl-modal__stack">
          <div className="wl-grid">
            <div className="wl-field">
              <label className="wl-label" htmlFor="ger-freq">Frequência ({min} a {max} horas)</label>
              <input
                id="ger-freq"
                className="wl-input"
                type="number"
                min={min}
                max={max}
                step={1}
                value={g.frequenciaFollowup}
                onChange={(e) => g.setFrequenciaFollowup(e.target.value)}
                placeholder={user.api_oficial ? 'Ex: 1' : 'Ex: 12'}
              />
            </div>
            <div className="wl-field">
              <label className="wl-label" htmlFor="ger-qtd">Quantidade de FollowUp (1 a 3)</label>
              <input
                id="ger-qtd"
                className="wl-input"
                type="number"
                min={1}
                max={3}
                step={1}
                value={g.quantidadeMaximaFollowup}
                onChange={(e) => g.setQuantidadeMaximaFollowup(e.target.value)}
                placeholder="Ex: 2"
              />
            </div>
          </div>
          <div className="wl-modal__foot wl-modal__foot--end" style={{ marginTop: 0 }}>
            {temSalvo && (
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={() => {
                  g.setFrequenciaFollowup(g.frequenciaFollowupSalva);
                  g.setQuantidadeMaximaFollowup(g.quantidadeMaximaFollowupSalva);
                  g.setIsEditingFrequenciaFollowup(false);
                }}
              >
                Cancelar
              </button>
            )}
            <button
              type="button"
              className="wl-btn wl-btn--lime"
              onClick={g.handleSaveFrequenciaFollowup}
              disabled={g.isSavingFrequenciaFollowup}
            >
              {g.isSavingFrequenciaFollowup ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </GeraisCard>
  );
};

export default FollowupFluxoCard;
