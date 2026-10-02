import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import GeraisDialog from '../gerais/GeraisDialog';
import type { MembrosCtx } from './useMembros';
import { formatAddMemberPhone, normalizeAddMemberPhone } from './phones';

/** Cadastro de um novo membro (nome, e-mail, telefone e senha inicial). */
const AdicionarMembroDialog = ({ m }: { m: MembrosCtx }) => (
  <GeraisDialog
    open={m.isDialogOpen}
    onOpenChange={m.setIsDialogOpen}
    title="Adicionar novo membro"
    description="Preencha as informações do novo membro da equipe"
    size="md"
    footer={
      <>
        <button
          type="button"
          className="wl-btn wl-btn--glass-ink"
          disabled={m.isLoading}
          onClick={() => {
            m.setIsDialogOpen(false);
            m.setShowNewMemberPassword(false);
          }}
        >
          Cancelar
        </button>
        <button type="submit" form="membro-add-form" className="wl-btn wl-btn--lime" disabled={m.isLoading}>
          {m.isLoading ? 'Adicionando...' : 'Adicionar membro'}
        </button>
      </>
    }
  >
    <form id="membro-add-form" onSubmit={m.handleSubmit} className="wl-modal__stack">
      <div className="wl-field">
        <label className="wl-label" htmlFor="nome">Nome completo</label>
        <input
          id="nome"
          className="wl-input"
          type="text"
          value={m.formData.nome}
          onChange={(e) => m.setFormData((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Ex: Rodrigo Henrique"
          required
        />
      </div>

      <div className="wl-field">
        <label className="wl-label" htmlFor="email">E-mail</label>
        <input
          id="email"
          className="wl-input"
          type="email"
          value={m.formData.email}
          onChange={(e) => m.setFormData((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="Ex: nome@empresa.com"
          required
        />
      </div>

      <div className="wl-field">
        <label className="wl-label" htmlFor="telefone">Telefone</label>
        <div className="wl-phone">
          <span className="wl-phone__ddi">+55</span>
          <input
            id="telefone"
            className="wl-input"
            type="tel"
            inputMode="numeric"
            value={formatAddMemberPhone(m.formData.telefone)}
            onChange={(e) => m.setFormData((prev) => ({ ...prev, telefone: normalizeAddMemberPhone(e.target.value) }))}
            placeholder="(12) 99598-9598"
            required
          />
        </div>
      </div>

      <div className="wl-field">
        <label className="wl-label" htmlFor="senha">Senha</label>
        <div className="wl-pwfield">
          <input
            id="senha"
            className="wl-input"
            type={m.showNewMemberPassword ? 'text' : 'password'}
            value={m.formData.senha}
            onChange={(e) => m.setFormData((prev) => ({ ...prev, senha: e.target.value }))}
            placeholder="Crie uma senha"
            required
          />
          <button
            type="button"
            className="wl-iconbtn"
            aria-label={m.showNewMemberPassword ? 'Ocultar senha' : 'Mostrar senha'}
            onClick={() => m.setShowNewMemberPassword((prev) => !prev)}
          >
            {m.showNewMemberPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          </button>
        </div>
      </div>
    </form>
  </GeraisDialog>
);

export default AdicionarMembroDialog;
