import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { GeraisCtx } from './useGerais';
import GeraisDialog from './GeraisDialog';

/** Troca de senha da conta: nova senha e confirmação, com opção de mostrar o texto. */
const AlterarSenhaDialog = ({ g }: { g: GeraisCtx }) => (
  <GeraisDialog
    open={g.changePasswordOpen}
    onOpenChange={g.setChangePasswordOpen}
    title="Alterar senha"
    description="Defina uma nova senha para sua conta."
    footer={
      <>
        <button
          type="button"
          className="wl-btn wl-btn--glass-ink"
          onClick={() => {
            g.setChangePasswordOpen(false);
            g.setShowNewPassword(false);
          }}
        >
          Cancelar
        </button>
        <button type="button" className="wl-btn wl-btn--lime" onClick={g.handleChangePassword} disabled={g.isSavingPassword}>
          {g.isSavingPassword ? 'Salvando...' : 'Salvar'}
        </button>
      </>
    }
  >
    <div className="wl-field">
      <label className="wl-label" htmlFor="new-password">Nova senha</label>
      <div className="wl-pwfield">
        <input
          id="new-password"
          className="wl-input"
          type={g.showNewPassword ? 'text' : 'password'}
          value={g.newPassword}
          onChange={(e) => g.setNewPassword(e.target.value)}
          placeholder="Digite a nova senha"
        />
        <button
          type="button"
          className="wl-iconbtn"
          aria-label={g.showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
          onClick={() => g.setShowNewPassword((prev) => !prev)}
        >
          {g.showNewPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      </div>
    </div>
    <div className="wl-field">
      <label className="wl-label" htmlFor="confirm-password">Confirmar senha</label>
      <input
        id="confirm-password"
        className="wl-input"
        type={g.showNewPassword ? 'text' : 'password'}
        value={g.confirmPassword}
        onChange={(e) => g.setConfirmPassword(e.target.value)}
        placeholder="Repita a nova senha"
      />
    </div>
  </GeraisDialog>
);

export default AlterarSenhaDialog;
