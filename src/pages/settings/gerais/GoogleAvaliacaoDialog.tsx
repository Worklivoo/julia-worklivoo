import React from 'react';
import type { GeraisCtx } from './useGerais';
import GeraisDialog from './GeraisDialog';

/** Edição do link de avaliação do Google que a IA envia quando o lead é qualificado. */
const GoogleAvaliacaoDialog = ({ g }: { g: GeraisCtx }) => {
  const cancelar = () => {
    g.setGoogleLinkAvaliacao(g.googleLinkAvaliacaoSalvo);
    g.setGoogleAvaliacaoPendingStatus(null);
    g.setGoogleAvaliacaoModalOpen(false);
  };

  return (
    <GeraisDialog
      open={g.googleAvaliacaoModalOpen}
      onOpenChange={(open) => {
        g.setGoogleAvaliacaoModalOpen(open);
        if (!open) g.setGoogleAvaliacaoPendingStatus(null);
        g.setGoogleLinkAvaliacao(g.googleLinkAvaliacaoSalvo);
      }}
      title="Google Avaliação"
      description="Edite o link que a IA deve enviar quando o lead for qualificado."
      size="md"
      footer={
        <>
          <button type="button" className="wl-btn wl-btn--glass-ink" onClick={cancelar}>
            Cancelar
          </button>
          <button type="button" className="wl-btn wl-btn--lime" onClick={g.handleSaveGoogleAvaliacao} disabled={g.isSavingGoogleAvaliacao}>
            {g.isSavingGoogleAvaliacao ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="wl-field">
        <label className="wl-label" htmlFor="ger-google-link">Link do Google Avaliação</label>
        <input
          id="ger-google-link"
          className="wl-input"
          type="url"
          value={g.googleLinkAvaliacao}
          onChange={(e) => g.setGoogleLinkAvaliacao(e.target.value)}
          placeholder="https://g.page/r/..."
        />
        <p className="wl-segment__hint">Obrigatório quando a funcionalidade estiver ativada.</p>
        <p className="wl-segment__hint">
          Não tem o link?{' '}
          <a
            className="wl-link"
            href="https://www.superchat.com/pt/tools/google-review-link-generator"
            target="_blank"
            rel="noopener noreferrer"
          >
            Gere o seu aqui
          </a>
          .
        </p>
      </div>
    </GeraisDialog>
  );
};

export default GoogleAvaliacaoDialog;
