import React from 'react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { BaseConhecimentoCtx } from './useBaseConhecimento';

/** Diálogo de pergunta e resposta, usado tanto para adicionar quanto para editar. */
const PerguntaDialog = ({ k, mode }: { k: BaseConhecimentoCtx; mode: 'create' | 'edit' }) => {
  const criando = mode === 'create';
  const formId = `conhecimento-${mode}-form`;

  return (
    <GeraisDialog
      open={criando ? k.createOpen : k.editOpen}
      onOpenChange={(open) => (criando ? k.setCreateOpen(open) : open ? undefined : k.closeEdit())}
      title={criando ? 'Adicionar pergunta' : 'Editar pergunta'}
      description={criando ? 'Essa pergunta e resposta ficarão disponíveis para a IA.' : 'Atualize a pergunta e a resposta.'}
      size="md"
      footer={
        <>
          <button
            type="button"
            className="wl-btn wl-btn--glass-ink"
            onClick={() => (criando ? k.setCreateOpen(false) : k.closeEdit())}
            disabled={k.saving}
          >
            Cancelar
          </button>
          <button type="submit" form={formId} className="wl-btn wl-btn--lime" disabled={k.saving}>
            {k.saving ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      }
    >
      <form
        id={formId}
        className="wl-modal__stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (criando) k.handleCreate();
          else k.handleEdit();
        }}
      >
        <div className="wl-field">
          <label className="wl-label" htmlFor={`${formId}-pergunta`}>Pergunta</label>
          <textarea
            id={`${formId}-pergunta`}
            className="wl-input"
            style={{ minHeight: 100 }}
            rows={4}
            value={k.pergunta}
            onChange={(e) => k.setPergunta(e.target.value)}
          />
        </div>
        <div className="wl-field">
          <label className="wl-label" htmlFor={`${formId}-resposta`}>Resposta</label>
          <textarea
            id={`${formId}-resposta`}
            className="wl-input"
            style={{ minHeight: 150 }}
            rows={6}
            value={k.resposta}
            onChange={(e) => k.setResposta(e.target.value)}
          />
        </div>
      </form>
    </GeraisDialog>
  );
};

export default PerguntaDialog;
