import React from 'react';
import { Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import type { AssinaturaCtx } from './useAssinatura';

/** Pagamento da primeira cobrança por PIX: QR Code, código copia-e-cola e espera da confirmação. */
const PixPagamento = ({ a }: { a: AssinaturaCtx }) => {
  const pix: any = a.pixPaymentData;

  return (
    <div className="wl-tabpane">
      <section className="wl-sub-card" aria-labelledby="ass-pix">
        <span className="wl-wa-state__icon"><QrCode aria-hidden="true" /></span>
        <h3 id="ass-pix" className="wl-sub-card__title">Pagamento via PIX</h3>
        <p className="wl-lede">Escaneie o QR Code ou copie o código abaixo para ativar sua assinatura.</p>

        <div className="wl-pay__qr" style={{ margin: '0 auto' }}>
          <img src={`data:image/png;base64,${pix.encodedImage}`} alt="QR Code PIX" />
        </div>

        <div className="wl-input-row wl-sub-card__copy">
          <input className="wl-input" readOnly value={pix.payload} aria-label="Código PIX copia e cola" />
          <button
            type="button"
            className="wl-btn wl-btn--glass-ink"
            onClick={() => {
              navigator.clipboard.writeText(pix.payload);
              toast.success('Código PIX copiado!');
            }}
          >
            <Copy aria-hidden="true" width={15} height={15} />
            Copiar
          </button>
        </div>

        <p className="wl-sub-card__wait" role="status">
          <span className="wl-spin" aria-hidden="true" />
          Aguardando pagamento...
        </p>

        <p className="wl-wa__hint">
          Valor: <strong>{pix.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
          {' · '}
          Vencimento: <strong>{pix.expirationDate.split('-').reverse().join('/')}</strong>
        </p>
      </section>
    </div>
  );
};

export default PixPagamento;
