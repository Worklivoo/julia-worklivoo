import React from 'react';
import type { GeraisCtx } from './useGerais';
import { renderSaudacaoTexto } from './saudacao';
import GeraisDialog from './GeraisDialog';

/** Escolha do modelo de mensagem de saudação; clicar num modelo já salva a escolha. */
const SaudacaoModeloDialog = ({ g }: { g: GeraisCtx }) => (
  <GeraisDialog
    open={!g.isTipoOutros && g.isEditingMensagemSaudacao}
    onOpenChange={(open) => {
      if (g.isTipoOutros) return;
      g.setIsEditingMensagemSaudacao(open);
    }}
    title="Selecionar modelo de saudação"
    description="Escolha um dos modelos para salvar."
    size="xl"
  >
    <div className="wl-plans wl-plans--auto">
      {g.saudacaoModelos.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`wl-plan wl-plan--text${g.idMensagemSaudacaoApiOficialSalvo === m.id ? ' is-selected' : ''}`}
          onClick={() => g.handleSelectMensagemSaudacaoModelo({ id: m.id, texto: m.texto })}
          disabled={g.isSavingMensagemSaudacao}
        >
          <span className="wl-plan__name">{m.titulo}</span>
          <span className="wl-plan__desc">{renderSaudacaoTexto(m.texto)}</span>
        </button>
      ))}
    </div>
  </GeraisDialog>
);

export default SaudacaoModeloDialog;
