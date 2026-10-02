import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { ComunicadoV2 } from '@/types';
import { getComunicadoRedirectUrl } from '@/lib/comunicados';
import '@/styles/worklivoo-tokens.css';
import '@/styles/worklivoo-components.css';
import '@/styles/worklivoo-lead.css';
import '@/styles/worklivoo-shell.css';

interface ComunicadoModalProps {
  comunicado: ComunicadoV2;
  onClose: (naoMostrarNovamente: boolean) => void;
}

/** Comunicado da Worklivoo: imagem, opção de não mostrar de novo e botão para o destino configurado. */
const ComunicadoModal: React.FC<ComunicadoModalProps> = ({ comunicado, onClose }) => {
  const [naoMostrarNovamente, setNaoMostrarNovamente] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  const redirectUrl = getComunicadoRedirectUrl(comunicado.comunicado_id);
  const tituloFallback = comunicado.comunicado_titulo || 'Comunicado Worklivoo';
  const imagemUrl = comunicado.comunicado_imagem || '';

  const handleContinue = () => {
    if (!redirectUrl) {
      onClose(naoMostrarNovamente);
      return;
    }
    setIsNavigating(true);
    onClose(naoMostrarNovamente);
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 100);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(naoMostrarNovamente); }}>
      <DialogContent
        className="wl-scope wl-modal wl-comunicado z-[75]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{tituloFallback}</DialogTitle>
        <DialogDescription className="sr-only">Comunicado da Worklivoo</DialogDescription>

        <div className="wl-comunicado__media">
          {!imageError && imagemUrl ? (
            <img src={imagemUrl} alt={tituloFallback} onError={() => setImageError(true)} />
          ) : (
            <div className="wl-comunicado__fallback">
              <strong>{tituloFallback}</strong>
              <span>{imageError ? 'Imagem não disponível.' : 'Nenhuma imagem associada.'}</span>
            </div>
          )}
        </div>

        <div className="wl-comunicado__body">
          <label className="wl-comunicado__check">
            <input
              type="checkbox"
              className="wl-checkbox"
              checked={naoMostrarNovamente}
              onChange={(e) => setNaoMostrarNovamente(e.target.checked)}
            />
            Não mostrar este comunicado novamente
          </label>

          <div className="wl-comunicado__actions">
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => onClose(naoMostrarNovamente)} disabled={isNavigating}>
              Fechar
            </button>
            <button
              type="button"
              className="wl-btn wl-btn--lime"
              onClick={handleContinue}
              disabled={isNavigating || !redirectUrl}
              title={!redirectUrl ? 'Nenhum destino configurado para este comunicado.' : ''}
            >
              {isNavigating ? 'Redirecionando...' : 'Continuar'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComunicadoModal;
