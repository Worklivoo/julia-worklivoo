import React from 'react';
import { Check } from 'lucide-react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { ApiOficialCtx } from './useApiOficial';

/** Escolha do DDD disponível para criar a API Oficial. */
const ApiOficialDddDialog = ({ a }: { a: ApiOficialCtx }) => (
  <GeraisDialog
    open={a.apiOfficialDialogOpen}
    onOpenChange={a.setApiOfficialDialogOpen}
    title="Conectar API Oficial"
    description="Escolha um DDD disponível para continuar a criação da sua API Oficial."
    size="md"
    footer={
      <>
        <button
          type="button"
          className="wl-btn wl-btn--glass-ink"
          onClick={() => a.setApiOfficialDialogOpen(false)}
          disabled={a.sendingApiOfficialWebhook}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="wl-btn wl-btn--lime"
          onClick={a.handleSubmitApiOfficialWebhook}
          disabled={a.sendingApiOfficialWebhook || a.apiOfficialPreferredDdd.length !== 2}
        >
          {a.sendingApiOfficialWebhook ? 'Enviando...' : 'Conectar'}
        </button>
      </>
    }
  >
    <div className="wl-field">
      <span className="wl-label">DDD disponível</span>
      <div className="wl-ddd" role="radiogroup" aria-label="DDD disponível">
        {a.salvyAreaCodes.map((ddd) => {
          const selecionado = a.apiOfficialPreferredDdd === ddd;
          return (
            <button
              key={ddd}
              type="button"
              role="radio"
              aria-checked={selecionado}
              className={`wl-ddd__item${selecionado ? ' is-selected' : ''}`}
              onClick={() => a.setApiOfficialPreferredDdd(ddd)}
            >
              <strong>{ddd}</strong>
              <span>{selecionado ? <Check aria-hidden="true" width={12} height={12} /> : 'Selecionar'}</span>
            </button>
          );
        })}
      </div>
      <p className="wl-wa__hint">
        {a.apiOfficialPreferredDdd ? `DDD selecionado: ${a.apiOfficialPreferredDdd}` : 'Nenhum DDD selecionado'}
      </p>
    </div>
  </GeraisDialog>
);

export default ApiOficialDddDialog;
