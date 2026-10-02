import React from 'react';
import { Banknote, QrCode } from 'lucide-react';
import type { AssinaturaCtx } from './useAssinatura';

/** Primeira tela de quem ainda não assinou: cupom e escolha da forma de pagamento (hoje só PIX). */
const EscolherPagamento = ({ a }: { a: AssinaturaCtx }) => {
  const cupomBloqueado = a.isValidatingCoupon || a.hasUsedCoupon || a.couponStatus === 'success';

  return (
    <div className="wl-tabpane">
      <section className="wl-sub-card" aria-labelledby="ass-escolha">
        <span className="wl-wa-state__icon"><Banknote aria-hidden="true" /></span>
        <h3 id="ass-escolha" className="wl-sub-card__title">Escolha a forma de pagamento</h3>
        <p className="wl-lede">Como você prefere realizar o pagamento da sua assinatura?</p>

        <div className="wl-set-box wl-sub-card__box">
          <div className="wl-field">
            <label className="wl-label" htmlFor="ass-cupom">Cupom</label>
            <div className="wl-input-row">
              <input
                id="ass-cupom"
                className="wl-input"
                type="text"
                placeholder="Digite seu cupom"
                value={a.couponCode}
                onChange={(e) => a.setCouponCode(e.target.value)}
                disabled={cupomBloqueado}
              />
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink"
                onClick={a.handleValidateCoupon}
                disabled={cupomBloqueado || !a.couponCode.trim()}
              >
                {a.isValidatingCoupon ? 'Validando...' : 'Validar'}
              </button>
            </div>
            {a.couponMessage && (
              <p className={`wl-alert${a.couponStatus === 'success' ? ' wl-alert--ok' : ''}`} role="status">
                {a.couponMessage}
              </p>
            )}
          </div>
        </div>

        <button type="button" className="wl-sub-card__opt" onClick={() => a.setPaymentMethod('PIX')}>
          <span className="wl-sub-card__optIcon"><QrCode aria-hidden="true" /></span>
          <span>
            <strong>PIX</strong>
            <small>Pagamento via código ou QR Code</small>
          </span>
        </button>
      </section>
    </div>
  );
};

export default EscolherPagamento;
