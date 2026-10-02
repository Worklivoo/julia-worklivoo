import React from 'react';
import { CheckCircle2, AlertTriangle, Plus, UserCircle } from 'lucide-react';
import { useMembros } from './membros/useMembros';
import MembroCard from './membros/MembroCard';
import AdicionarMembroDialog from './membros/AdicionarMembroDialog';
import EditarMembroDialog from './membros/EditarMembroDialog';
import ConfirmarMembroDialog from './membros/ConfirmarMembroDialog';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-page.css';
import '@/styles/worklivoo-settings.css';

/**
 * Aba "Membros" das Configurações: equipe da empresa (o administrador não aparece na lista).
 * Lógica em `membros/useMembros.ts`; cartão, menu e diálogos nos demais arquivos da pasta.
 */
export const MembrosTab: React.FC = () => {
  const m = useMembros();

  if (m.loading) {
    return (
      <div className="wl-tabpane">
        <p className="wl-clist__note wl-clist__note--center">Carregando membros...</p>
      </div>
    );
  }

  const podeAdicionar = m.canAddMembers();

  return (
    <div className="wl-tabpane">
      <div className="wl-tabhead">
        <div>
          <h3 className="wl-section__title">Membros da equipe</h3>
          <p className="wl-lede">Gerencie os membros da sua equipe</p>
        </div>
        {podeAdicionar && (
          <button type="button" className="wl-btn wl-btn--lime wl-btn--sm" onClick={() => m.setIsDialogOpen(true)}>
            <Plus aria-hidden="true" width={15} height={15} />
            Adicionar membro
          </button>
        )}
      </div>

      {m.message.text && (
        <p
          className={`wl-alert wl-members__alert${m.message.type === 'success' ? ' wl-alert--ok' : ''}`}
          role={m.message.type === 'error' ? 'alert' : 'status'}
        >
          {m.message.type === 'success' ? <CheckCircle2 aria-hidden="true" /> : <AlertTriangle aria-hidden="true" />}
          {m.message.text}
        </p>
      )}

      {m.visibleMembros.length === 0 ? (
        <div className="wl-empty">
          <span className="wl-empty__icon"><UserCircle aria-hidden="true" /></span>
          <p className="wl-empty__title">Nenhum membro encontrado</p>
          <p className="wl-empty__text">Comece adicionando o primeiro membro da sua equipe</p>
          {podeAdicionar && (
            <button type="button" className="wl-btn wl-btn--lime wl-btn--sm" style={{ marginTop: 12 }} onClick={() => m.setIsDialogOpen(true)}>
              <Plus aria-hidden="true" width={15} height={15} />
              Adicionar primeiro membro
            </button>
          )}
        </div>
      ) : (
        <div className="wl-members">
          {m.visibleMembros.map((membro) => (
            <MembroCard key={membro.membro_id} membro={membro} m={m} />
          ))}
        </div>
      )}

      <AdicionarMembroDialog m={m} />
      <EditarMembroDialog m={m} />

      <ConfirmarMembroDialog
        state={m.deleteAlert}
        onOpenChange={(open) => m.setDeleteAlert({ open, membro: null })}
        title="Excluir membro"
        details="excluir"
        warning="Esta ação não pode ser desfeita e removerá o membro da tabela e do sistema de autenticação."
        confirmLabel="Excluir"
        busyLabel="Excluindo..."
        busy={Boolean(m.actionLoading?.includes('delete'))}
        danger
        onConfirm={m.handleDeleteMembro}
      />
      <ConfirmarMembroDialog
        state={m.deactivateAlert}
        onOpenChange={(open) => m.setDeactivateAlert({ open, membro: null })}
        title="Desativar membro"
        details="desativar"
        warning="O membro não poderá mais acessar o sistema até ser reativado."
        confirmLabel="Desativar"
        busyLabel="Desativando..."
        busy={Boolean(m.actionLoading?.includes('deactivate'))}
        onConfirm={m.handleDeactivateMembro}
      />
    </div>
  );
};

export default MembrosTab;
