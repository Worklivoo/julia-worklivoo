import React, { useState } from 'react';
import { X } from 'lucide-react';
import type { ComunicadoV2 } from '@/types';
import { getComunicadoRedirectUrl } from '@/lib/comunicados';

interface ComunicadoModalProps {
  comunicado: ComunicadoV2;
  onClose: (naoMostrarNovamente: boolean) => void;
}

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
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative rounded-[24px] bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{
          maxHeight: '92vh',
          maxWidth: '92vw',
          width: 'min(92vw, calc(92vh - 160px))',
        }}
      >
        <button
          type="button"
          className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-white/90 backdrop-blur shadow-md hover:bg-white flex items-center justify-center text-gray-600 hover:text-black transition-colors"
          onClick={() => onClose(naoMostrarNovamente)}
          aria-label="Fechar comunicado"
        >
          <X size={18} />
        </button>

        <div className="w-full aspect-square bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
          {!imageError && imagemUrl ? (
            <img
              src={imagemUrl}
              alt={tituloFallback}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
              <div className="text-2xl font-black text-black mb-2">{tituloFallback}</div>
              <div className="text-sm text-gray-500">
                {imageError ? 'Imagem não disponível.' : 'Nenhuma imagem associada.'}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-shrink-0">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={naoMostrarNovamente}
              onChange={(e) => setNaoMostrarNovamente(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black accent-black"
            />
            <span className="text-xs font-semibold text-gray-600">
              Não mostrar este comunicado novamente
            </span>
          </label>

          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 py-3 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60"
              onClick={() => onClose(naoMostrarNovamente)}
              disabled={isNavigating}
            >
              Fechar
            </button>
            <button
              type="button"
              className="flex-1 py-3 rounded-2xl text-sm font-bold bg-[#EBF57D] text-black hover:bg-[#e3ef62] transition-all flex items-center justify-center disabled:opacity-60 disabled:hover:bg-[#EBF57D]"
              onClick={handleContinue}
              disabled={isNavigating || !redirectUrl}
              title={!redirectUrl ? 'Nenhum destino configurado para este comunicado.' : ''}
            >
              {isNavigating ? 'Redirecionando...' : 'Continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComunicadoModal;

