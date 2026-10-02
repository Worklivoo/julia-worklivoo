import React from 'react';
import type { GeraisCtx } from './useGerais';
import { transbordoEtapasOptions } from './constants';
import GeraisDialog from './GeraisDialog';

/** Escolha das etapas do lead em que o transbordo de FollowUp deve valer (seleção múltipla). */
const TransbordoEtapasDialog = ({ g }: { g: GeraisCtx }) => {
  const cancelar = () => {
    g.setTransbordoEtapasDraft(g.transbordoEtapasSelecionadas);
    g.setTransbordoEtapasOpen(false);
  };

  return (
    <GeraisDialog
      open={g.transbordoEtapasOpen}
      onOpenChange={(open) => {
        g.setTransbordoEtapasOpen(open);
        if (open) g.setTransbordoEtapasDraft(g.transbordoEtapasSelecionadas);
      }}
      title="Etapas do Lead"
      description="Selecione em quais etapas o transbordo de follow up deve considerar o lead."
      size="md"
      footer={
        <>
          <button type="button" className="wl-btn wl-btn--glass-ink" onClick={cancelar}>
            Cancelar
          </button>
          <button type="button" className="wl-btn wl-btn--lime" onClick={g.handleSaveTransbordoEtapas} disabled={g.isSavingTransbordoEtapas}>
            {g.isSavingTransbordoEtapas ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="wl-plans wl-plans--auto">
        {transbordoEtapasOptions.map((etapa) => {
          const selected = g.transbordoEtapasDraft.includes(etapa);
          return (
            <button
              key={etapa}
              type="button"
              aria-pressed={selected}
              className={`wl-plan wl-plan--text${selected ? ' is-selected' : ''}`}
              onClick={() =>
                g.setTransbordoEtapasDraft((prev) =>
                  prev.includes(etapa) ? prev.filter((item) => item !== etapa) : [...prev, etapa]
                )
              }
            >
              <span className="wl-plan__name">{etapa}</span>
            </button>
          );
        })}
      </div>
    </GeraisDialog>
  );
};

export default TransbordoEtapasDialog;
