import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import termosHtml from '@/terms/termos-de-uso.html?raw';
import type { GeraisCtx } from './useGerais';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-settings.css';

/** Leitura dos termos de uso da Worklivoo. */
const TermosDialog = ({ g }: { g: GeraisCtx }) => (
  <Dialog open={g.termsOpen} onOpenChange={g.setTermsOpen}>
    <DialogContent className="wl-scope wl-modal wl-modal--terms" onOpenAutoFocus={(e) => e.preventDefault()}>
      <DialogHeader className="wl-modal__head">
        <DialogTitle className="wl-title wl-title--sm">Termos de uso</DialogTitle>
        <DialogDescription className="wl-lede">Visualize os termos de uso da Worklivoo.</DialogDescription>
      </DialogHeader>
      <div className="wl-modal__scroll">
        <div className="wl-terms" dangerouslySetInnerHTML={{ __html: termosHtml }} />
      </div>
    </DialogContent>
  </Dialog>
);

export default TermosDialog;
