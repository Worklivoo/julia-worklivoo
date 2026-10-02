import React from 'react';
import { Check, FileText } from 'lucide-react';
import type { FollowUpPagamentoCtx } from './useFollowUpPagamento';
import type { FollowUpKind } from './kinds';
import '@/styles/worklivoo-settings.css';

const brl = (value: number) => String(value.toFixed(2)).replace('.', ',');

/** Passo 3: cobrança PIX (QR Code, copia e cola, PDF) e confirmação do pagamento. */
const ContratarPixStep = ({ pagamento, kind }: { pagamento: FollowUpPagamentoCtx; kind: FollowUpKind }) => {
  const {
    selectedPlan,
    planoProrrateado,
    pagamentoAtivo,
    pagamentoConfirmadoUI,
    isPollingPagamento,
    isCreatingQrCode,
    isGeneratingPdf,
    handleGerarQrCode,
    handleCopiarPixPayload,
    handleDownloadPagamentoPdf,
    handleAcquireBack,
    handleCloseAcquireDialog,
  } = pagamento;
  if (!selectedPlan) return null;

  const qrSrc = pagamentoAtivo?.pix.base64
    ? pagamentoAtivo.pix.base64.startsWith('data:')
      ? pagamentoAtivo.pix.base64
      : `data:image/png;base64,${pagamentoAtivo.pix.base64}`
    : pagamentoAtivo?.pix.qrCodeImageUrl || '';

  return (
    <div>
      <div className="wl-stephead">
        <div>
          <h3>3. Pagamento via PIX</h3>
          <p>
            {pagamentoAtivo
              ? 'Use o QR Code ou o código copia e cola para pagar. Após a confirmação a funcionalidade será ativada automaticamente.'
              : 'Gerando QR Code do PIX para concluir a contratação...'}
          </p>
        </div>
        <span className="wl-pill">Passo 3 de 3</span>
      </div>

      {!pagamentoAtivo && planoProrrateado && (
        <div className="wl-pay">
          <span className="wl-pill wl-pill--soft">Pagamento instantâneo via PIX</span>
          <div className="wl-pay__qr" aria-live="polite">
            <div>
              <span className="wl-spin" aria-hidden="true" />
              <p className="wl-set-tile__value wl-set-tile__value--sm" style={{ marginTop: 10 }}>Gerando QR Code PIX...</p>
              <p className="wl-set-card__sub">Aguarde alguns segundos enquanto geramos a sua cobrança.</p>
            </div>
          </div>
          <div className="wl-money"><small>R$</small><strong>{brl(planoProrrateado.valorRateio)}</strong></div>
          <p className="wl-pay__line">
            <strong>Plano {selectedPlan.nome} · {selectedPlan.volume.toLocaleString('pt-BR')} envios</strong>
            {' · '}
            Válido para o ciclo {planoProrrateado.inicioCiclo} até {planoProrrateado.fimCiclo}.
          </p>
          <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleGerarQrCode} disabled={isCreatingQrCode}>
            {isCreatingQrCode ? (
              <>
                <span className="wl-spinner" aria-hidden="true" />
                Gerando cobrança...
              </>
            ) : (
              'Tentar novamente'
            )}
          </button>
        </div>
      )}

      {pagamentoAtivo && planoProrrateado && (
        <div className="wl-pay">
          {pagamentoConfirmadoUI && (
            <div className="wl-pay__done" role="status">
              <div>
                <span className="wl-pay__check"><Check aria-hidden="true" /></span>
                <h4 className="wl-set-card__title" style={{ fontSize: 20 }}>Pagamento recebido!</h4>
                <p className="wl-set-card__sub">
                  O PIX foi confirmado. Estamos preparando a sua ativação.
                  <br />
                  Essa janela será fechada automaticamente em alguns segundos.
                </p>
                <div className="wl-pay__bar"><i /></div>
              </div>
            </div>
          )}

          {pagamentoAtivo.status === 'RECEIVED' ? (
            <span className="wl-tag wl-tag--won">Pagamento confirmado</span>
          ) : isPollingPagamento ? (
            <span className="wl-pill wl-pill--soft">Verificando pagamento em tempo real...</span>
          ) : (
            <span className="wl-pill wl-pill--soft">Pagamento PIX gerado • aguardando confirmação</span>
          )}

          <div className="wl-pay__qr">
            {qrSrc ? (
              <img src={qrSrc} alt={`QR Code PIX FollowUp ${kind.nome}`} />
            ) : (
              <div>
                <p className="wl-set-tile__value wl-set-tile__value--sm">Use o código copia e cola</p>
                <p className="wl-set-card__sub">Copie o código PIX abaixo e cole no app do seu banco.</p>
              </div>
            )}
          </div>

          <div className="wl-money"><small>R$</small><strong>{brl(pagamentoAtivo.valorRateio)}</strong></div>
          <p className="wl-pay__line">
            <strong>Plano {selectedPlan.nome}</strong> · {selectedPlan.volume.toLocaleString('pt-BR')} envios · Ciclo{' '}
            {pagamentoAtivo.ciclo.inicio} até {pagamentoAtivo.ciclo.fim}
          </p>
          <p className="wl-pay__line">
            <strong>Válido até:</strong>{' '}
            {pagamentoAtivo.pix.expirationDate
              ? new Date(pagamentoAtivo.pix.expirationDate).toLocaleString('pt-BR')
              : 'a confirmação do pagamento'}
          </p>

          <div className="wl-pay__actions">
            <button type="button" className="wl-btn wl-btn--lime" onClick={handleCopiarPixPayload}>
              Copiar código PIX
            </button>
            <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleDownloadPagamentoPdf} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? (
                <>
                  <span className="wl-spinner" aria-hidden="true" />
                  Preparando PDF...
                </>
              ) : (
                <>
                  <FileText aria-hidden="true" width={16} height={16} />
                  Baixar PDF do pagamento
                </>
              )}
            </button>
          </div>

          {pagamentoAtivo.pix.payload && (
            <div className="wl-payload">
              <div className="wl-payload__head">
                <span className="wl-label">Código PIX copia e cola</span>
                <button type="button" className="wl-textlink" onClick={handleCopiarPixPayload}>Copiar</button>
              </div>
              <code>{pagamentoAtivo.pix.payload.match(/.{1,80}/g)?.join('\n')}</code>
            </div>
          )}
        </div>
      )}

      <div className="wl-footrow">
        <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleAcquireBack}>Voltar</button>
        <div className="wl-footrow__end">
          <button type="button" className="wl-link" onClick={handleCloseAcquireDialog}>
            {pagamentoAtivo ? 'Fechar e pagar depois' : 'Cancelar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContratarPixStep;
