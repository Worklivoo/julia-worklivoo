import React from 'react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { MembrosCtx } from './useMembros';
import { normalizePhone } from './phones';

/** Edição de nome e telefone de um membro (e-mail e cargo não mudam por aqui). */
const EditarMembroDialog = ({ m }: { m: MembrosCtx }) => (
  <GeraisDialog
    open={m.editMemberOpen}
    onOpenChange={m.closeEditMemberDialog}
    title="Editar membro"
    description="Edite apenas nome e telefone do membro."
    footer={
      <>
        <button
          type="button"
          className="wl-btn wl-btn--glass-ink"
          onClick={() => m.closeEditMemberDialog(false)}
          disabled={m.savingMemberEdit}
        >
          Cancelar
        </button>
        <button type="submit" form="membro-edit-form" className="wl-btn wl-btn--lime" disabled={m.savingMemberEdit}>
          {m.savingMemberEdit ? 'Salvando...' : 'Salvar'}
        </button>
      </>
    }
  >
    <form id="membro-edit-form" onSubmit={m.handleSaveEditMember} className="wl-modal__stack">
      <div className="wl-field">
        <label className="wl-label" htmlFor="membro-edit-nome">Nome</label>
        <input
          id="membro-edit-nome"
          className="wl-input"
          value={m.editMemberForm.nome}
          onChange={(e) => m.setEditMemberForm((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Nome do membro"
          disabled={m.savingMemberEdit}
        />
      </div>
      <div className="wl-field">
        <label className="wl-label" htmlFor="membro-edit-telefone">Telefone</label>
        <input
          id="membro-edit-telefone"
          className="wl-input"
          value={m.editMemberForm.telefone}
          onChange={(e) => m.setEditMemberForm((prev) => ({ ...prev, telefone: normalizePhone(e.target.value) }))}
          placeholder="Telefone do membro"
          disabled={m.savingMemberEdit}
        />
      </div>
    </form>
  </GeraisDialog>
);

export default EditarMembroDialog;
