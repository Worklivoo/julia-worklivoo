import React from 'react';
import InfoTip from '@/components/InfoTip';
import type { FollowUpPagamentoCtx } from './useFollowUpPagamento';
import '@/styles/worklivoo-settings.css';

const brl = (value: number) => value.toFixed(2).replace('.', ',');

/** Passo 2: resumo da contratação (valor proporcional agora e valor cheio nas próximas faturas). */
const ContratarResumoStep = ({ pagamento }: { pagamento: FollowUpPagamentoCtx }) => {
  const { selectedPlan, planoProrrateado, handleAcquireBack, handleCloseAcquireDialog, handleAcquireNext } = pagamento;
  if (!selectedPlan || !planoProrrateado) return null;

  return (
    <div>
      <div className="wl-stephead">
        <div>
          <h3>2. Resumo da contratação</h3>
          <p>Confira o valor do pagamento antecipado e as próximas cobranças.</p>
        </div>
        <span className="wl-pill">Passo 2 de 3</span>
      </div>

      <div className="wl-set-card">
        <div className="wl-set-card__head">
          <div>
            <h4 className="wl-set-card__title">Plano {selectedPlan.nome}</h4>
            <p className="wl-set-card__sub">Volume de {selectedPlan.volume.toLocaleString('pt-BR')} leads por ciclo.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="wl-label">Ciclo atual</span>
            <p className="wl-set-card__sub" style={{ color: 'var(--ink)', fontWeight: 700 }}>
              {planoProrrateado.inicioCiclo} até {planoProrrateado.fimCiclo}
            </p>
          </div>
        </div>

        <div className="wl-set-grid">
          <div className="wl-set-box">
            <div>
              <div className="wl-set-tile__top" style={{ justifyContent: 'flex-start', gap: 8 }}>
                <span className="wl-label">Valor do pagamento</span>
                <InfoTip label="Como o valor é calculado">
                  <p><strong>Como esse valor é calculado</strong></p>
                  <p>
                    Consideramos o dia de vencimento da sua assinatura (dia {planoProrrateado.diaVencimento}) e calculamos um valor proporcional aos dias restantes do ciclo atual.
                  </p>
                  <p>Valor do plano: R$ {brl(planoProrrateado.valorPlanoCheio)} por mês.</p>
                  <p>
                    Dias restantes neste ciclo: {planoProrrateado.diasRestantes} de {planoProrrateado.totalDiasCiclo} dias.
                  </p>
                  {planoProrrateado.valorRateioAjustadoParaMinimo && (
                    <p>
                      O cálculo proporcional daria R$ {brl(planoProrrateado.valorRateioCalculado)}, mas o valor mínimo aceito para pagamento via PIX é R$ 5,00.
                    </p>
                  )}
                </InfoTip>
              </div>
              <div className="wl-money" style={{ marginTop: 8 }}>
                <small>R$</small>
                <strong>{brl(planoProrrateado.valorRateio)}</strong>
              </div>
              <p className="wl-set-card__sub" style={{ marginTop: 8 }}>
                {planoProrrateado.valorRateioAjustadoParaMinimo
                  ? `Ajustado para o valor mínimo de pagamento via PIX (dias restantes até o vencimento dia ${planoProrrateado.diaVencimento}).`
                  : `Referente aos dias restantes até o vencimento dia ${planoProrrateado.diaVencimento}.`}
              </p>
            </div>

            <div className="wl-dlrows">
              <div>
                Valor mensal <strong>R$ {brl(planoProrrateado.valorPlanoCheio)}</strong>
              </div>
              <div>
                Dias restantes no ciclo <strong>{planoProrrateado.diasRestantes} dias</strong>
              </div>
            </div>
          </div>

          <ul className="wl-bullets" style={{ alignSelf: 'center' }}>
            <li>
              <strong>Pagamento hoje:</strong> o valor ao lado é cobrado uma única vez agora via PIX para ativar imediatamente o plano.
            </li>
            <li>
              <strong>Próximas faturas:</strong> o valor cheio do plano (R$ {brl(planoProrrateado.valorProxFatura)}/mês) será automaticamente adicionado às próximas faturas da sua assinatura, no dia {planoProrrateado.diaVencimento}.
            </li>
          </ul>
        </div>
      </div>

      <div className="wl-footrow">
        <button type="button" className="wl-btn wl-btn--glass-ink" onClick={handleAcquireBack}>Voltar</button>
        <div className="wl-footrow__end">
          <button type="button" className="wl-link" onClick={handleCloseAcquireDialog}>Cancelar</button>
          <button type="button" className="wl-btn wl-btn--lime" onClick={handleAcquireNext}>
            Pagar R$ {brl(planoProrrateado.valorRateio)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContratarResumoStep;
