import React from 'react';
import { toast } from 'sonner';
import GeraisDialog from '../gerais/GeraisDialog';
import type { AssinaturaCtx } from './useAssinatura';

/** Antecipação de fatura: confirmação da cobrança e, no PIX, o QR Code para pagar. */
const AnteciparDialogs = ({ a }: { a: AssinaturaCtx }) => {
  const pagamento =
    String(a.cardFinal || '').toUpperCase() === 'PIX' ? 'PIX' : a.cardFinal ? `Cartão •••• ${a.cardFinal}` : 'Cartão';
  const pix = a.advancePixQrData;

  return (
    <>
      <GeraisDialog
        open={a.showAdvanceInvoiceConfirm}
        onOpenChange={(open) => {
          if (!open && !a.isAdvancingInvoice) a.setShowAdvanceInvoiceConfirm(false);
        }}
        title="Confirmar antecipação"
        description="Ao confirmar, será cobrado o valor total da sua fatura em aberto e o vencimento das próximas faturas será antecipado para o dia de hoje."
        footer={
          <>
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={() => a.setShowAdvanceInvoiceConfirm(false)} disabled={a.isAdvancingInvoice}>
              Fechar
            </button>
            <button type="button" className="wl-btn wl-btn--lime" onClick={a.confirmAdvanceInvoice} disabled={a.isAdvancingInvoice}>
              {a.isAdvancingInvoice ? 'Processando...' : 'Confirmar'}
            </button>
          </>
        }
      >
        <div className="wl-set-box">
          <div className="wl-row">
            <span className="wl-label">Valor</span>
            <span className="wl-kv__value wl-kv__value--lg">{a.formatCurrencyBRL(Number(a.advanceInvoicePayment?.value || 0))}</span>
          </div>
          <div className="wl-row">
            <span className="wl-label">Pagamento</span>
            <span className="wl-kv__value">{pagamento}</span>
          </div>
        </div>
      </GeraisDialog>

      <GeraisDialog
        open={Boolean(a.showAdvancePixQr && pix)}
        onOpenChange={(open) => {
          if (!open && !a.isAdvancingInvoice) {
            a.setShowAdvancePixQr(false);
            a.setAdvancePixQrData(null);
          }
        }}
        title="Pague para antecipar"
        description="Ao confirmar o pagamento, o ciclo será reiniciado e o vencimento passará a ser o dia de hoje."
        size="md"
      >
        {pix && (
          <>
            <p className="wl-wa__hint">
              Valor: <strong>{a.formatCurrencyBRL(pix.value)}</strong>
            </p>
            <div className="wl-pay__qr" style={{ margin: '0 auto' }}>
              <img alt="QR Code PIX" src={`data:image/png;base64,${pix.encodedImage}`} />
            </div>
            <div className="wl-set-box">
              <span className="wl-label">Código PIX</span>
              <span className="wl-kv__value wl-kv__value--mono">{pix.payload}</span>
              <button
                type="button"
                className="wl-btn wl-btn--glass-ink wl-btn--block"
                disabled={a.isAdvancingInvoice}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(pix.payload);
                    toast.success('Código PIX copiado!');
                  } catch {
                    toast.error('Não foi possível copiar o código.');
                  }
                }}
              >
                Copiar código
              </button>
            </div>
            <p className="wl-sub-card__wait" role="status">
              <span className="wl-spin" aria-hidden="true" />
              Aguardando confirmação do pagamento...
            </p>
          </>
        )}
      </GeraisDialog>
    </>
  );
};

export default AnteciparDialogs;
