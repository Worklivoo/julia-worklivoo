import React from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Membro } from '@/lib/membros';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-settings.css';

/** Confirmação de ação destrutiva sobre um membro (excluir ou desativar). */
const ConfirmarMembroDialog = ({
  state,
  onOpenChange,
  title,
  details,
  warning,
  confirmLabel,
  busyLabel,
  busy,
  danger,
  onConfirm,
}: {
  state: { open: boolean; membro: Membro | null };
  onOpenChange: (open: boolean) => void;
  title: string;
  details: string;
  warning?: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  danger?: boolean;
  onConfirm: (membro: Membro) => void;
}) => (
  <AlertDialog open={state.open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="wl-scope wl-modal wl-modal--sm" onOpenAutoFocus={(e) => e.preventDefault()}>
      <AlertDialogHeader className="wl-modal__head">
        <AlertDialogTitle className="wl-title wl-title--sm">{title}</AlertDialogTitle>
        <AlertDialogDescription className="wl-lede" asChild>
          <div>
            <p>
              Tem certeza que deseja {details} <strong>{state.membro?.membro_nome}</strong>?
            </p>
            {warning && <p className="wl-confirm__warn">{warning}</p>}
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="wl-modal__foot wl-modal__foot--end">
        <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => onOpenChange(false)}>
          Cancelar
        </button>
        <button type="button" className={`wl-btn ${danger ? 'wl-btn--danger' : 'wl-btn--lime'}`} disabled={busy} onClick={() => state.membro && onConfirm(state.membro)}>
            {busy ? busyLabel : confirmLabel}
          </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmarMembroDialog;
