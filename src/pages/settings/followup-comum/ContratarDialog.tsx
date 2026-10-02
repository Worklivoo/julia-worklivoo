import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { FollowUpPagamentoCtx } from './useFollowUpPagamento';
import type { FollowUpKind } from './kinds';
import ContratarPlanoStep from './ContratarPlanoStep';
import ContratarResumoStep from './ContratarResumoStep';
import ContratarPixStep from './ContratarPixStep';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

/** Diálogo de contratação em 3 passos: plano, resumo do rateio e pagamento via PIX. */
const ContratarDialog = ({ pagamento, kind }: { pagamento: FollowUpPagamentoCtx; kind: FollowUpKind }) => {
  const {
    isAcquireDialogOpen,
    setIsAcquireDialogOpen,
    handleCloseAcquireDialog,
    acquireStep,
    selectedPlan,
    planoProrrateado,
  } = pagamento;

  return (
    <Dialog
      open={isAcquireDialogOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCloseAcquireDialog();
        } else {
          setIsAcquireDialogOpen(open);
        }
      }}
    >
      <DialogContent className="wl-scope wl-modal wl-modal--lg" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader className="wl-modal__head">
          <DialogTitle className="wl-title wl-title--sm">Contratar FollowUp {kind.nome}</DialogTitle>
          <DialogDescription className="wl-lede">Complete os passos abaixo para ativar a funcionalidade.</DialogDescription>
        </DialogHeader>

        <div className="wl-modal__scroll">
          {acquireStep === 1 && <ContratarPlanoStep pagamento={pagamento} kind={kind} />}
          {acquireStep === 2 && selectedPlan && planoProrrateado && <ContratarResumoStep pagamento={pagamento} />}
          {acquireStep === 3 && selectedPlan && <ContratarPixStep pagamento={pagamento} kind={kind} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContratarDialog;
